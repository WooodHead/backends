const debug = require('debug')('search:graphql:resolvers:_queries:search')
const {
  Roles: {
    userHasRole,
    userIsInRoles
  }
} = require('@orbiting/backend-modules-auth')
const {
  schema: documentSchema,
  addRelatedDocs
} = require('../../../lib/Documents')
const {
  filterReducer,
  getFilterValue,
  getFilterObj,
  elasticFilterBuilder
} = require('../../../lib/filters')
const {
  extractAggs
} = require('../../../lib/aggregations')
const {
  createSort
} = require('../../../lib/sort')
const {
  __resolveType: resolveHitType
} = require('../SearchEntity')
const { transformUser } = require('@orbiting/backend-modules-auth')

const _ = require('lodash')
const uuid = require('uuid/v4')

const indices = require('../../../lib/indices')
const { getIndexAlias } = require('../../../lib/utils')

const reduceFilters = filterReducer(documentSchema)
const createElasticFilter = elasticFilterBuilder(documentSchema)

const {
  DOCUMENTS_RESTRICT_TO_ROLES,
  SEARCH_TRACK = false
} = process.env

const DEV = process.env.NODE_ENV && process.env.NODE_ENV !== 'production'

const deepMergeArrays = function (objValue, srcValue) {
  if (_.isArray(objValue)) {
    return objValue.concat(srcValue)
  }
}

const createShould = function (
  searchTerm, searchFilter, indicesList, user, scheduledAt
) {
  const queries = []

  // A query for each ES index
  indicesList.forEach(({ type, index, search }) => {
    let must = {
      match_all: {}
    }

    let should = []

    let fields = Object.keys(search.termFields)

    // Append boost if available, annotation "<field name>^<boost>"
    fields = fields.map(field => {
      const boost = search.termFields[field].boost
      if (boost) {
        return `${field}^${boost}`
      }

      return field
    })

    if (searchTerm) {
      must = [
        { multi_match: {
          query: searchTerm,
          type: 'best_fields',
          fields
        } }
      ]

      should = [
        { multi_match: {
          query: searchTerm,
          type: 'phrase',
          fields
        } },
        { multi_match: {
          query: searchTerm,
          type: 'cross_fields',
          fields
        } }
      ]
    }

    const rolbasedFilterArgs = Object.assign(
      {},
      { scheduledAt },
      getFilterObj(searchFilter)
    )

    const rolebasedFilterDefault =
      _.get(search, 'rolebasedFilter.default', () => ({}))(rolbasedFilterArgs)

    const rolebasedFilter = Object.assign({}, rolebasedFilterDefault)

    if (userHasRole(user, 'editor')) {
      Object.assign(
        rolebasedFilter,
        _.get(
          search,
          'rolebasedFilter.editor',
          () => rolebasedFilterDefault
        )(rolbasedFilterArgs)
      )
    }

    const filter = _.mergeWith(
      {},
      search.filter,
      createElasticFilter(searchFilter),
      rolebasedFilter,
      deepMergeArrays
    )

    debug('filter', JSON.stringify(filter, null, 2))

    queries.push({
      bool: {
        must,
        should,
        filter
      }
    })
  })

  return queries
}

const createHighlight = (indicesList) => {
  const fields = {}

  // A query for each ES index
  indicesList.forEach(({ search }) => {
    Object.keys(search.termFields).forEach((field) => {
      if (search.termFields[field].highlight) {
        fields[field] = search.termFields[field].highlight
      }
    })
  })

  return { fields }
}

const createQuery = (
  searchTerm, filter, sort, indicesList, user, scheduledAt, withoutContent
) => ({
  query: {
    bool: {
      should: createShould(
        searchTerm, filter, indicesList, user, scheduledAt
      )
    }
  },
  sort: createSort(sort),
  highlight: createHighlight(indicesList),
  aggs: extractAggs(documentSchema),
  ...withoutContent
    ? { _source: {
      'exclude': [ 'content.children', 'contentString', 'resolved' ]
    } }
    : { }
})

const mapHit = (hit) => {
  const type = resolveHitType(hit._source)
  const entity = type === 'User'
    ? transformUser(hit._source)
    : hit._source

  const highlights = []
  Object.keys(hit.highlight || {}).forEach(path => {
    highlights.push({ path, fragments: hit.highlight[path] })
  })

  return {
    entity,
    highlights,
    score: hit._score,
    type
  }
}

const transformTermsAgg = (key, agg, t) => ({
  key,
  label: t(
    `api/search/aggs/${key}`,
    { key },
    !DEV ? key : undefined
  ),
  buckets: agg.terms.buckets.map(bucket => ({
    label: t(
      `api/search/aggs/${key}/${bucket.key}`,
      { key, value: bucket.key, count: bucket.doc_count },
      !DEV ? bucket.key : undefined
    ),
    value: bucket.key,
    count: bucket.doc_count
  }))
})

const transformCountAgg = (key, agg, t) => ({
  key,
  label: t(
    `api/search/aggs/${key}`,
    { key },
    !DEV ? key : undefined
  ),
  count: agg.count ? agg.count.value : agg.doc_count
})

const transformRangeAgg = (key, agg, t) => ({
  key,
  label: t(
    `api/search/aggs/${key}`,
    { key },
    !DEV ? key : undefined
  ),
  count: agg.doc_count,
  buckets: agg.ranges.buckets.map(bucket => ({
    label: t(
      `api/search/aggs/${key}/${bucket.key}`,
      { key, value: bucket.key, count: bucket.doc_count },
      !DEV ? bucket.key : undefined
    ),
    value: bucket.key,
    count: bucket.doc_count
  }))
})

const mapAggregations = (result, t) => {
  const aggregations = result.aggregations
  if (!aggregations) {
    return []
  }
  return Object.keys(aggregations).map(name => {
    const parts = name.match(/(.*?)\/(.*)/)
    const type = parts[1]
    const key = parts[2]

    const agg = aggregations[name]

    switch (type) {
      case 'terms':
        return transformTermsAgg(key, agg, t)
      case 'valueCount':
      case 'trueCount':
      case 'existsCount':
        return transformCountAgg(key, agg, t)
      case 'range':
        return transformRangeAgg(key, agg, t)
      default:
        throw Error(`Unable to transform aggregation type "${type}"`)
    }
  })
}

const cleanOptions = (options) => ({
  ...options,
  after: undefined,
  before: undefined,
  filter: undefined,
  trackingId: undefined
})

const stringifyOptions = (options) =>
  Buffer.from(JSON.stringify(options)).toString('base64')

const parseOptions = (options) => {
  try {
    return JSON.parse(Buffer.from(options, 'base64').toString())
  } catch (e) {
    console.info('failed to parse options:', options, e)
  }
  return {}
}

const MAX_NODES = 10000 // Limit, but exceedingly high

const getFirst = (first, filter, user) => {
  // we only restrict the nodes array
  // making totalCount always available
  // - querying a single document by path is always allowed
  const path = getFilterValue(filter, 'path')
  const repoId = getFilterValue(filter, 'repoId')
  const oneRepoId = repoId && (!Array.isArray(repoId) || repoId.length === 1)
  if (DOCUMENTS_RESTRICT_TO_ROLES && !path && !oneRepoId) {
    const roles = DOCUMENTS_RESTRICT_TO_ROLES.split(',')
    if (!userIsInRoles(user, roles)) {
      return 0
    }
  }

  if (first > MAX_NODES) {
    return MAX_NODES
  }

  return first
}

const getIndicesList = (filter) => {
  const limitType = getFilterValue(filter, 'type')
  const indicesFilter = limitType
    ? ({type}) => type === limitType
    : Boolean

  return indices.list.filter(indicesFilter)
}

const search = async (__, args, context) => {
  const { user, elastic, t } = context
  const {
    after,
    before,
    skipLoadRelatedDocs = false,
    scheduledAt,
    trackingId = uuid(),
    withoutContent = false
  } = args

  const options = after
    ? { ...args, ...parseOptions(after) }
    : before
      ? { ...args, ...parseOptions(before) }
      : args

  const {
    search,
    filter: filterObj = { },
    filters: filterArray = [],
    sort = {
      key: 'relevance',
      direction: 'DESC'
    },
    first: _first = 40,
    from = 0
  } = options

  debug('options', JSON.stringify(options))

  Object.keys(filterObj).forEach(key => {
    filterArray.push({
      key,
      value: filterObj[key]
    })
  })

  const filter = reduceFilters(filterArray)

  debug('filter', JSON.stringify(filter))

  const first = getFirst(_first, filter, user)

  const indicesList = getIndicesList(filter)
  const query = {
    index: indicesList.map(({ name }) => getIndexAlias(name, 'read')),
    from,
    size: first,
    body: createQuery(search, filter, sort, indicesList, user, scheduledAt, withoutContent)
  }

  debug('ES query', JSON.stringify(query))
  const result = await elastic.search(query)
  // debug('result: %O', result)

  if (
    skipLoadRelatedDocs &&
    filterObj.repoId && filterObj.repoId.length > 0 &&
    filterObj.repoId.length !== result.hits.total
  ) {
    console.warn('--------------------------------------------')
    console.warn('ES query response insufficent')
    console.warn(
      JSON.stringify(
        _.omit(result, ['hits.hits', 'aggregations'])
      )
    )
    console.warn('--------------------------------------------')
  }

  const hasNextPage = first > 0 && result.hits.total > from + first
  const hasPreviousPage = from > 0

  const response = {
    nodes: result.hits.hits.map(mapHit),
    aggregations: mapAggregations(result, t),
    totalCount: result.hits.total,
    pageInfo: {
      hasNextPage,
      endCursor: hasNextPage
        ? stringifyOptions(cleanOptions({
          ...options,
          filters: filterArray,
          first,
          from: from + first
        }))
        : null,
      hasPreviousPage,
      startCursor: hasPreviousPage
        ? stringifyOptions(cleanOptions({
          ...options,
          filters: filterArray,
          first,
          from: from - first
        }))
        : null
    },
    trackingId
  }

  if (!skipLoadRelatedDocs && (!filter.type || filter.type === 'Document')) {
    await addRelatedDocs({
      connection: response,
      context
    })
  }

  if (!skipLoadRelatedDocs && SEARCH_TRACK) {
    try {
      const took = result.took
      const total = result.hits.total
      const hits = result.hits.hits
        .map(hit => _.omit(hit, '_source'))

      const filters = options.filters
        ? options.filters.map(filter => {
          if (typeof filter.value !== 'string') {
            filter.value = JSON.stringify(filter.value)
          }

          return filter
        })
        : []

      await elastic.index({
        index: getIndexAlias('searches'),
        type: 'Search',
        body: {
          took,
          options: Object.assign({}, options, { filters }),
          query,
          total,
          hits,
          date: new Date(),
          trackingId
        }
      })
    } catch (err) {
      // Log but do not fail
      console.error('search, tracking', err)
    }
  }

  return response
}

module.exports = search

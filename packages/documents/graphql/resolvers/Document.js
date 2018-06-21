const {
  contentUrlResolver,
  metaUrlResolver
} = require('../../lib/resolve')
const {
  processMembersOnlyZonesInContent,
  processRepoImageUrlsInContent,
  processRepoImageUrlsInMeta,
  processImageUrlsInContent
} = require('../../lib/process')
const { getMeta } = require('../../lib/meta')

const { lib: { webp: {
  addSuffix: addWebpSuffix
} } } = require('@orbiting/backend-modules-assets')

const shouldDeliverWebP = (argument = 'auto', req) => {
  if (argument === 'auto') {
    return req && req.get('Accept').indexOf('image/webp') > -1
  }
  return !!argument
}

module.exports = {
  content (doc, { urlPrefix, searchString, webp }, context, info) {
    // we only do auto slugging when in a published documents context
    // - this is easiest detectable by _all being present from documents resolver
    // - alt check info.path for documents / document being the root
    //   https://gist.github.com/tpreusse/f79833a023706520da53647f9c61c7f6
    const unresolvedRepoIds = []
    if (doc._all) {
      contentUrlResolver(doc, doc._all, doc._usernames, unresolvedRepoIds, urlPrefix, searchString)

      if (shouldDeliverWebP(webp, context.req)) {
        processRepoImageUrlsInContent(doc.content, addWebpSuffix)
        processImageUrlsInContent(doc.content, addWebpSuffix)
      }

      processMembersOnlyZonesInContent(doc.content, context.user)
    }
    if (!doc._all) {
      console.warn('Document.content resolver missing doc._all')
      console.warn('doc', doc.meta)
      console.warn('---------------------------------')
    }
    if (unresolvedRepoIds.length > 0) {
      console.warn('Document.content resolver encountered unresolvedRepoIds')
      console.warn(JSON.stringify(unresolvedRepoIds))
      console.warn('doc', JSON.stringify(doc.meta))
      console.warn('---------------------------------')
    }
    return doc.content
  },
  meta (doc, { urlPrefix, searchString, webp }, context, info) {
    const unresolvedRepoIds = []
    const meta = getMeta(doc)
    if (doc._all) {
      metaUrlResolver(meta, doc._all, doc._usernames, unresolvedRepoIds, urlPrefix, searchString)

      if (shouldDeliverWebP(webp, context.req)) {
        processRepoImageUrlsInMeta(doc.content, addWebpSuffix)
      }
    }
    if (!doc._all) {
      console.warn('Document.meta resolver missing doc._all')
      console.warn('doc', doc.meta)
      console.warn('---------------------------------')
    }
    if (unresolvedRepoIds.length > 0) {
      console.warn('Document.meta resolver encountered unresolvedRepoIds')
      console.warn(JSON.stringify(unresolvedRepoIds))
      console.warn('doc', JSON.stringify(doc.meta))
      console.warn('---------------------------------')
    }
    return meta
  }
}

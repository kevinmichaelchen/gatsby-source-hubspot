const fetch = require('node-fetch')
const queryString = require('query-string')
const crypto = require('crypto')
const debug = require('debug')('hubspot-source-plugin');

exports.sourceNodes = ({boundActionCreators, createNodeId}, configOptions) => {
  console.log('EXECUTING HUBSPOT PLUGIN')
  const { createNode } = boundActionCreators

  delete configOptions.plugins

  const topics = []
  const findTopicByID = topicID => topics.find(t => t.id === topicID)

  const processTopic = topic => {
    const nodeId = createNodeId(`hubspot-topic-${topic.id}`)
    const nodeContent = JSON.stringify(topic)
    const nodeContentDigest = crypto
      .createHash('md5')
      .update(nodeContent)
      .digest('hex')

    const nodeData = Object.assign({}, topic, {
      id: nodeId,
      parent: null,
      children: [],
      internal: {
        type: `HubspotTopic`,
        content: nodeContent,
        contentDigest: nodeContentDigest
      }
    })

    return nodeData
  }

  const processPost = post => {
    const nodeId = createNodeId(`hubspot-post-${post.id}`)
    const nodeContent = JSON.stringify(post)
    const nodeContentDigest = crypto
      .createHash('md5')
      .update(nodeContent)
      .digest('hex')

    const nodeData = Object.assign({}, post, {
      id: nodeId,
      parent: null,
      children: [],
      internal: {
        type: `HubspotPost`,
        content: nodeContent,
        contentDigest: nodeContentDigest
      }
    })

    return nodeData
  }

  const API_KEY = configOptions.key
  const filters = configOptions.filters
    ? queryString.stringify(configOptions.filters)
    : null
  const API_ENDPOINT = `https://api.hubapi.com/content/api/v2/blog-posts?hapikey=${API_KEY}${
    filters ? '&' + filters : ''
  }`

  if (!API_KEY) throw new Error('No Hubspot API key provided')

  console.log(
    '\n  gatsby-source-hubspot\n  ------------------------- \n  Fetching posts from: \x1b[33m%s\x1b[0m',
    `\n  ${API_ENDPOINT}\n`
  )

  const handleErrors = response => {
    if (!response.ok) {
      throw new Error(`Received bad response from Hubspot API: ${response.ok}`)
    }
    return response
  }

  fetch(`https://api.hubapi.com/blogs/v3/topics?hapikey=${API_KEY}&limit=1000`)
    .then(handleErrors)
    .then(response => response.json())
    .then(data => data.objects.forEach(topic => {
      topics.push(topic)
    }))
    .catch(error => console.log(error))

  topics.forEach(topic => createNode(processTopic(topic)))
  console.log('Found', topics.length, 'topics')

  return fetch(API_ENDPOINT)
    .then(response => response.json())
    .then(data => {
      const cleanData = data.objects.map(post => {
        debug('post keys: ', Object.keys(post));
        return {
          id: post.id,
          title: post.title,
          body: post.post_body,
          state: post.state,
          author: post.blog_post_author
            ? {
                id: post.blog_post_author.id,
                avatar: post.blog_post_author.avatar.avatar,
                name: post.blog_post_author.display_name,
                full_name: post.blog_post_author.full_name,
                bio: post.blog_post_author.bio,
                email: post.blog_post_author.email,
                facebook: post.blog_post_author.facebook,
                google_plus: post.blog_post_author.google_plus,
                linkedin: post.blog_post_author.linkedin,
                twitter: post.blog_post_author.twitter,
                twitter_username: post.blog_post_author.twitter_username,
                website: post.blog_post_author.website,
                slug: post.blog_post_author.slug
              }
            : null,
          featured_image: post.featured_image,
          featured_image_alt_text: post.featured_image_alt_text,
          featured_image_height: post.featured_image_height,
          featured_image_length: post.featured_image_length,
          featured_image_width: post.featured_image_width,
          meta: {
            title: post.page_title,
            description: post.meta_description
          },
          summary: post.post_summary,
          published: post.publish_date,
          updated: post.updated,
          created: post.created,
          slug: post.slug,
          subcategory: post.subcategory,
          resolved_domain: post.resolved_domain,
          label: post.label,
          tag_ids: post.tag_ids,
          topics: post.topic_ids.map(findTopicByID).filter(id => id !== undefined),
          absolute_url: post.absolute_url
        }
      })
      console.log('Found', cleanData.length, 'posts')
      cleanData.forEach(post => {
        createNode(processPost(post))
      })
    })
}

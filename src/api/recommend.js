import request from '@/utils/request'

export function getRecommend(query) {
  return request({
    url: '/api/rec',
    method: 'post',
    data: query
  })
}

export function getHighlight(query) {
  return request({
    url: '/api/highlight',
    method: 'post',
    data: query
  })
}

export function getContent(query) {
  return request({
    url: '/api/content',
    method: 'post',
    data: query
  })
}

export function uploadUserLog(query) {
  return request({
    url: '/api/add_useract_to_db',
    method: 'post',
    data: query
  })
}
  

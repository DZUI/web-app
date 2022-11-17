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
  

import request from '@/utils/request'

export function getRecommend(query) {
  return request({
    url: '/api/rec',
    method: 'post',
    data: query
  })
}

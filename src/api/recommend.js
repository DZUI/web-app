import request from '@/utils/request'

export function getRecommend(query) {
  return request({
    url: 'http://localhost:8000/api/rec',
    method: 'get',
    params: query
  })
}

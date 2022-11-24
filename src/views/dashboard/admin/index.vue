<template>
  <div class="dashboard-editor-container">
    <div class="main-article-container" v-loading="loading">
      <div class="main-article article-item" area-name="main">
        <div class="title">
          {{ mainArticle.item }}
        </div>
        <div class="sub-title">
          {{ highlightTextArr[0] }}
        </div>
        <div class="article-content">
          <p v-for="(item, index) in mainArticleContentArr" :key="index" class="article-content-text">
            {{ item }}
          </p>
        </div>
      </div>
      <div class="more-article" v-loading="bottomLoading">
        <el-row>
          <el-col v-for="(article, index) in moreArtcleList" :key="index" :xs="24" :sm="24" :lg="8">
            <div class="more-article-item article-item" :area-name="'article' + (index + 1)">
              {{ article.item }}
            </div>
          </el-col>
        </el-row>
      </div>
    </div>

    <div class="info-block">
      当前追踪刷新率 300 ms
      <br>
      主区域停留推荐阈值
      <el-input v-model="resetRecommedTime" size="mini">
        <template slot="append">ms</template>
      </el-input>
      <br>
      底部域停留推荐阈值
      <el-input v-model="changeToMainTime" size="mini">
        <template slot="append">ms</template>
      </el-input>
      空白域停留推荐阈值
      <el-input v-model="blankTime" size="mini">
        <template slot="append">ms</template>
      </el-input>
      <el-divider />
      当前处于 {{ eyePotiner.areaName }} 区域
      <br>
      停留时长 {{ ((eyePotiner.nowTimestamp - eyePotiner.startTimestamp) / 1000).toFixed(1) }} s
      <br>
      上次推荐间隔时长 {{ ((eyePotiner.nowTimestamp - eyePotiner.resetRecommedTimestamp) / 1000).toFixed(1) }} s
      <br>
      x: {{ eyePotiner.x.toFixed(1) }}
      <br>
      y: {{ eyePotiner.y.toFixed(1) }}
      <br>
      高亮接口发送请求中: {{ highlightLoading ? '是' : '否'}}
      <br>
      推荐接口debug信息: 
      <div class="debug-info">
        <json-viewer
        :value="csvData"
        :expand-depth=3></json-viewer>
      </div>
    </div>
  </div>
</template>

<script>
import $ from 'jquery'
import { getRecommend, getHighlight, getContent } from '@/api/recommend'
const refreshTime = 300

const throttle = (func, wait = 50) => {
  // 上一次执行该函数的时间
  let lastTime = 0
  return function (...args) {
    // 当前时间
    const now = +new Date()
    // 将当前时间和上一次执行函数时间对比
    // 如果差值大于设置的等待时间就执行函数
    if (now - lastTime > wait) {
      lastTime = now
      func.apply(this, args)
    }
  }
}

export default {
  name: 'DashboardAdmin',
  components: {},
  data() {
    return {
      mainArticle: '',
      mainArticleContent: '',
      moreArtcleList: [],
      eyePotiner: {
        x: 0,
        y: 0,
        areaName: '-',
        startTimestamp: 0,
        resetRecommedTimestamp: 0, // 重新推荐时间
        nowTimestamp: 0
      },
      areas: [],
      csvData: [],
      changeToMainTime: 3000,
      resetRecommedTime: 5000,
      blankTime: 5000,
      loading: false,
      bottomLoading: false,
      highlightTextArr: [],
      highlightLoading: false,
    }
  },
  computed: {
    mainArticleContentArr() {
      return this.mainArticleContent.split('\n');
    }
  },
  watch: {
    csvData(newVal) {
      if (newVal.length !== 0) {
        this.mainArticle = newVal[0]
        this.moreArtcleList = newVal.filter((value, index, array) => index > 0)
        this.$nextTick(() => {
          this.getAreas()
        })
      }
    },
    'eyePotiner.areaName'(newVal) {
      this.hasChanged = false
    },
    mainArticle(newVal) {
      if (newVal) {
        this.getContent()
      }
    }
  },
  mounted() {
    window.saveDataAcrossSessions = true
    window.webgazer
      .setGazeListener((data, timestamp) => {
        // console.log(data, timestamp)
        this.caculatePosition(data, timestamp)
      }).begin()

    this.getRecommond()
  },
  methods: {
    caculatePosition: throttle(function (data, timestamp) {
      if (data == null) return

      const { x, y } = data
      this.eyePotiner.x = x
      this.eyePotiner.y = y

      try {
        // 获取停留区域名称
        const areaName = this.checkInWitchArea(x, y)
        // 如果区域名称有变化，则更新时间
        if (this.eyePotiner.areaName !== areaName) {
          this.eyePotiner.areaName = areaName
          this.eyePotiner.startTimestamp = timestamp
          this.eyePotiner.resetRecommedTimestamp = timestamp
        }
        this.eyePotiner.nowTimestamp = timestamp

        // 如果没在可视区域，则不继续了
        if (!this.eyePotiner.areaName) {
          return
        }

        if (this.eyePotiner.areaName === 'main' && (this.eyePotiner.nowTimestamp - this.eyePotiner.resetRecommedTimestamp) > this.resetRecommedTime) {
          // 主区域5s以上，且推荐时间超过5s，拉取高亮接口
          this.getHighlight()
          this.eyePotiner.resetRecommedTimestamp = timestamp
        } else if (this.eyePotiner.areaName === '-' && (this.eyePotiner.nowTimestamp - this.eyePotiner.resetRecommedTimestamp) > this.blankTime) {
          // 空白区域5s以上，且推荐时间超过5s，拉取推荐接口
          this.getRecommond(true)
          this.highlightTextArr = []
          this.eyePotiner.resetRecommedTimestamp = timestamp
        } else if ((this.eyePotiner.areaName !== 'main' && this.eyePotiner.areaName !== '') && (this.eyePotiner.nowTimestamp - this.eyePotiner.resetRecommedTimestamp) > this.changeToMainTime) {
          // 底部文章区域3s以上，切换文章到主区域
          const activeAreaIndex = this.areas.findIndex((value) => value.areaName === this.eyePotiner.areaName)
          this.csvData.splice(0, 1, JSON.parse(JSON.stringify(this.csvData[activeAreaIndex])))
          this.highlightTextArr = []
          this.$nextTick(() => {
            this.eyePotiner.resetRecommedTimestamp = timestamp
          })
        }
      } catch (error) {

      }
    }, refreshTime),
    getAreas() {
      const articles = document.getElementsByClassName('article-item')
      const areas = []
      articles.forEach((value) => {
        const { top, left } = $(value).offset()
        areas.push({
          top,
          left,
          width: $(value).width(),
          height: $(value).height(),
          areaName: $(value).attr('area-name')
        })
      })
      this.areas = areas
      console.log(this.areas)
    },
    checkInWitchArea(x, y) {
      let areaName = '-'
      for (let i = 0; i < this.areas.length; i++) {
        const area = this.areas[i]
        if (x > area.left && x < (area.left + area.width) && y > area.top && y < (area.top + area.height)) {
          areaName = area.areaName || '-'
          break
        }
      }

      return areaName
    },
    async getRecommond(refresh = false, append = false) {
      if (append) {
        this.bottomLoading = true
      } else {
        this.loading = true
      }

      try {
        // 请求数据
        const { data } = await getRecommend({
          'data': {
            'user': 0,
            'item': refresh ? [{
              title: '',
              content: ''
            }] : this.mainArticle?.item ? [{
              title: this.mainArticle.item,
              content: this.highlightTextArr.join(',')
            }] : [{
              title: '',
              content: ''
            }],
            'context': ['gaze_feat1', 'gaze_feat2', 'gaze_feat3']
          },
          'controller': {
            'recall_mode': 0,
            'rank_mode': 0,
            'rerank_mode': 0
          },
          'config': {
            'recall_param': {
              'threshold': 1.0,
              'top_k': 50
            },
            'rank_param': {
              'threshold': 1.0,
              'top_k': 5
            }
          },
          'debug': 0
        })
        console.log(data)
        
        if (append && this.csvData.length !== 0) {
          let first
          first = JSON.parse(JSON.stringify(this.csvData[0]))
          data.unshift(first)
          data.splice(data.length - 1, 1)
        }

        this.csvData = data
        this.loading = false
        this.bottomLoading = false
      } catch (error) {
        this.bottomLoading = true
        // 请求出错兜底
        let first
        if (this.csvData.length !== 0) {
          first = JSON.parse(JSON.stringify(this.csvData[0]))
        }
        setTimeout(() => {
          const csvData = first ? [first] : []
          const csvDataInitLength = 0
          for (let i = 0; i < 4 - csvDataInitLength; i++) {
            const randomValue = this.random(0, 10000)
            csvData.push({
              item: `${randomValue} 圆梦中国人”百姓宣讲活动今天启动`,
              value: randomValue
            })
          }
          this.csvData = csvData
          this.loading = false
        }, 600)
      }
    },
    async getHighlight() {
      if (this.highlightLoading) {
        return
      }
      this.highlightLoading = true
      try {
        // 请求数据
        const { data } = await getHighlight({
          "data": {
            "user": 0,
            'item': this.mainArticleContent ? [this.mainArticleContent] : [''],
            "context": [
              "gaze_feat1",
              "gaze_feat2",
              "gaze_feat3"
            ]
          },
          "config": {
            "model_type": 0
          },
          "debug": 0
        });
        this.highlightTextArr = data.map((value) => value.item)
      } catch (error) {
        console.log(error)
      }
      this.highlightLoading = false
      this.getRecommond(false, true)
    },
    // 高亮
    brightenKeyword(val, keywords = []) {
      if (!val) {
        return val;
      }
      keywords.forEach(item => {
        if (val.indexOf(item) !== -1 && item !== "") {
          val = val.replace(
            new RegExp(item, 'g'),
            '<font color="#f75353">' + item + "</font>"
          );
        }
      });
      return val;
    },
    random(a, b) { // 随机函数  随机生成a和b之间的一个数
      return Math.round(Math.random() * (b - a) + a) // 公式
    },
    async getContent() {
      try {
        // 请求数据
        const res = await getContent({
          key: this.mainArticle?.item
        });
        this.mainArticleContent = res.value;

        // this.getHighlight();
      } catch (error) {
        console.log(error)
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.dashboard-editor-container {
  padding: 0 32px;
  background-color: rgb(240, 242, 245);
  position: relative;
  height: 100vh;
  width: 100%;

  .info-block {
    position: fixed;
    right: 10px;
    top: 10px;
    width: 180px;
    z-index: 99;
    font-size: 12px;
    line-height: 20px;

    .debug-info {
      height: 240px;
      overflow: auto;
    }
  }

  .main-article-container {
    height: 100%;
    width: 1200px;
    display: flex;
    margin: 0 auto;
    flex-direction: column;

    .article-item {
      border: 1px solid black;
      text-align: center;
    }

    .main-article {
      flex: 1;
      overflow-y: auto;
      padding: 12px;

      .title {
        font-size: 16px;
        font-weight: bold;
      }

      .sub-title {
        height: 60px;
        padding: 10px 200px;
        color: #999;
      }

      .article-content {
        padding: 0px 200px;
        line-height: 24px;
        
        .article-content-text {
          white-space: pre-wrap;
          text-align: left;
          text-indent: 2em;
        }
      }
    }

    .more-article {
      flex-shrink: 0;
      height: 240px;
      overflow: hidden;

      .more-article-item {
        padding: 12px;
        height: 240px;
      }
    }
  }
}
</style>

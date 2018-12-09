import Store from 'electron-store'
import { Message } from 'element-ui'
import githubApi from '@/api/github.api'

const store = new Store({
  name: 'whu-library-seat'
})

const githubAuth = {
  state: {
    authInfo: {
      useListForAuth: store.get('authInfo_useListForAuth', false),
      githubAuthToken: store.get('authInfo_githubAuthToken', null),
      githubUserInfo: store.get('authInfo_githubUserInfo', null),
      haveStaredRepo: store.get('authInfo_haveStaredRepo', false)
    },
    formVisible: false
  },
  mutations: {
    TRIGGER_AUTH_FORM: (state, visible) => {
      if (visible === undefined) {
        state.formVisible = !state.formVisible
      } else {
        state.formVisible = visible
      }
    },
    RESTORE_AUTH: (state) => {
      state.authInfo.useListForAuth = false
      state.authInfo.githubAuthToken = null
      state.authInfo.githubUserInfo = null
      state.authInfo.haveStaredRepo = false
      store.set('authInfo_useListForAuth', false)
      store.set('authInfo_githubAuthToken', null)
      store.set('authInfo_githubUserInfo', null)
      store.set('authInfo_haveStaredRepo', false)
    },
    USE_LIST_FOR_AUTH: (state) => {
      state.authInfo.useListForAuth = true
      state.authInfo.githubAuthToken = null
      state.authInfo.githubUserInfo = null
      state.authInfo.haveStaredRepo = false
      store.set('authInfo_useListForAuth', true)
      store.set('authInfo_githubAuthToken', null)
      store.set('authInfo_githubUserInfo', null)
      store.set('authInfo_haveStaredRepo', false)
    },
    SAVE_AUTH_TOKEN: (state, token) => {
      if (token !== undefined) {
        state.authInfo.githubAuthToken = token
        store.set('authInfo_githubAuthToken', token)
      } else {
        Message({
          message: `GitHub 令牌无效`,
          type: 'error',
          duration: 3000,
          showClose: true
        })
      }
    },
    SAVE_GITHUB_USER_INFO: (state, info) => {
      state.authInfo.githubUserInfo = info
      store.set('authInfo_githubUserInfo', info)
      if (!info) {
        state.authInfo.githubUserInfo = {
          avatar_url: 'static/authed.svg'
        }
      }
    },
    TRIGGER_STAERD: (state, stared) => {
      state.authInfo.haveStaredRepo = stared
      store.set('authInfo_haveStaredRepo', stared)
      if (stared) {
        state.authInfo.useListForAuth = false
        store.set('authInfo_useListForAuth', false)
      }
    }
  },
  actions: {
    checkIfAuthed ({ commit, dispatch, state }) {
      if (!state.authInfo.useListForAuth &&
        (!state.authInfo.githubAuthToken ||
        !state.authInfo.haveStaredRepo)
      ) {
        commit('RESTORE_AUTH')
      } else if (!state.authInfo.useListForAuth) {
        dispatch('updateUserInfo', state.authInfo.githubAuthToken)
        dispatch('checkIfStared', { token: state.authInfo.githubAuthToken, cursor: null })
          .then(([token, haveStared]) => {
            if (!haveStared) {
              store.set('authInfo_githubAuthToken', null)
              Message({
                message: `GitHub Star 授权检测失败，您需要在下次启动软件时重新认证`,
                type: 'warning',
                duration: 0,
                showClose: true
              })
            }
          })
          .catch(() => {})
      }
    },
    async checkIfStared ({ dispatch }, payload) {
      try {
        const data = await new Promise((resolve, reject) => {
          githubApi.checkStared(payload.token, payload.cursor)
            .then(([token, lastCursor, haveStarted]) => {
              return resolve({
                continue: !haveStarted && !!lastCursor,
                token,
                haveStarted,
                lastCursor
              })
            })
            .catch((error) => {
              return reject(error)
            })
        })
        return data.continue
          ? dispatch('checkIfStared', { token: data.token, cursor: data.lastCursor })
          : Promise.resolve([data.token, data.haveStarted])
      } catch (error) {
        return Promise.reject(error)
      }
    },
    saveAuthToken ({ commit, dispatch }, token) {
      return new Promise((resolve, reject) => {
        commit('SAVE_AUTH_TOKEN', token)
        dispatch('updateUserInfo', token)
        resolve(token)
      })
    },
    updateUserInfo ({ commit }, token) {
      // get user info
      githubApi.getUserInfo(token).then((response) => {
        if (response.status === 200) {
          commit('SAVE_GITHUB_USER_INFO', response.data)
        } else {
          commit('SAVE_GITHUB_USER_INFO', null)
          Message({
            message: `获取 GitHub 用户信息失败`,
            type: 'error',
            duration: 3000,
            showClose: true
          })
        }
      }).catch((e) => {
        commit('SAVE_GITHUB_USER_INFO', null)
        Message({
          message: `获取 GitHub 用户信息失败用户信息失败：${e.message}`,
          type: 'error',
          duration: 3000,
          showClose: true
        })
      })
    }
  }
}

export default githubAuth

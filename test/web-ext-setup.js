const browser = {
  extension: {
    inIncognitoContext: false,
  },
  i18n: {
    getUILanguage: () => 'en',
  },
  windows: {
    getCurrent() {
      return new Promise((res, rej) => {
        res({
          id: 123,
        })
      })
    },

    getAll() {
      return new Promise((res, rej) => {
        res([
          {
            id: 123,
          },
          {
            id: 1,
          },
          {
            id: 2,
          },
        ])
      })
    },
  },
}

global.browser = browser
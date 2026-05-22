module.exports = {
  plugins: {
    'postcss-pxtorem': {
      mediaQuery: true,
      minPixelValue: 0,
      propList: ['*'],
      remPrecision: 5,
      rootValue: 16,
    },
  },
};

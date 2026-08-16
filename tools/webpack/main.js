const webpack = require('webpack');

module.exports = {
  entry: './src/main/index.js',
  // dbus-next optionally requires these for code paths this app never
  // exercises (X11-based bus address discovery, an alternate socket
  // backend); they aren't installed, and webpack's static analysis treats
  // that as a hard build error otherwise. Externalizing leaves the
  // require() calls for Node to resolve at runtime, where they're simply
  // never reached.
  externals: {
    x11: 'commonjs x11',
    usocket: 'commonjs usocket',
    'event-stream': 'commonjs event-stream',
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.PUBLIC_POSTHOG_KEY': JSON.stringify(process.env.PUBLIC_POSTHOG_KEY),
    }),
  ],
};

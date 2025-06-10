const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const isDevelopment = process.env.NODE_ENV !== 'production';

module.exports = {
  mode: isDevelopment ? 'development' : 'production',
  
  entry: {
    taskpane: './src/client/js/taskpane.js',
    fullscreen: './src/client/js/fullscreen.js',
    'function-file': './src/client/js/function-file.js'
  },
  
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'js/[name].[contenthash].js',
    clean: true,
    publicPath: '/',
  },
  
  resolve: {
    extensions: ['.js', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src/client'),
      '@utils': path.resolve(__dirname, 'src/client/js/utils'),
      '@components': path.resolve(__dirname, 'src/client/js/components'),
      '@styles': path.resolve(__dirname, 'src/client/styles')
    }
  },
  
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            cacheDirectory: true
          }
        }
      },
      {
        test: /\.css$/,
        use: [
          isDevelopment ? 'style-loader' : MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              sourceMap: isDevelopment,
              importLoaders: 1
            }
          }
        ]
      },
      {
        test: /\.(png|jpe?g|gif|svg|ico)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/images/[name].[hash][ext]'
        }
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/fonts/[name].[hash][ext]'
        }
      }
    ]
  },
  
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/client/html/taskpane.html',
      filename: 'taskpane.html',
      chunks: ['taskpane'],
      minify: !isDevelopment,
      inject: 'body'
    }),
    
    new HtmlWebpackPlugin({
      template: './src/client/html/fullscreen.html',
      filename: 'fullscreen.html',
      chunks: ['fullscreen'],
      minify: !isDevelopment,
      inject: 'body'
    }),
    
    new HtmlWebpackPlugin({
      template: './src/client/html/function-file.html',
      filename: 'function-file/function-file.html',
      chunks: ['function-file'],
      minify: !isDevelopment,
      inject: 'body'
    }),
    
    ...(isDevelopment ? [] : [
      new MiniCssExtractPlugin({
        filename: 'css/[name].[contenthash].css',
        chunkFilename: 'css/[id].[contenthash].css'
      })
    ])
  ],
  
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 20
        },
        office: {
          test: /[\\/]node_modules[\\/]@microsoft[\\/]office-js/,
          name: 'office-js',
          chunks: 'all',
          priority: 30
        },
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          priority: 10,
          reuseExistingChunk: true
        }
      }
    },
    runtimeChunk: {
      name: 'runtime'
    }
  },
  
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    compress: true,
    port: 3000,
    hot: true,
    open: false,
    historyApiFallback: true,
    allowedHosts: 'all',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization'
    },
    client: {
      overlay: {
        errors: true,
        warnings: false
      }
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  },
  
  devtool: isDevelopment ? 'eval-source-map' : 'source-map',
  
  performance: {
    hints: isDevelopment ? false : 'warning',
    maxEntrypointSize: 512000,
    maxAssetSize: 512000
  },
  
  cache: {
    type: 'filesystem',
    cacheDirectory: path.resolve(__dirname, '.webpack-cache'),
    buildDependencies: {
      config: [__filename]
    }
  }
};
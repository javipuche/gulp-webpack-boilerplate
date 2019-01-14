const path                 = require('path');
const UglifyJSPlugin       = require('uglifyjs-webpack-plugin');
const merge                = require('webpack-merge');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const isProduction         = process.argv.indexOf('--production') >= 0;


/* -----------------------------------------------------------------------------
 * Common Config
 */

let common = {
    output: {
        path: path.join(__dirname, 'dist'),
        filename: 'assets/js/app.js',
        publicPath: '/'
    },
    resolve: {
        extensions: ['*', '.js', '.json', '.scss'],
        alias: {
            node_modules: path.join(__dirname, 'node_modules'),
            layouts: path.join(__dirname, 'src/layouts'),
            pages: path.join(__dirname, 'src/pages'),
            partials: path.join(__dirname, 'src/partials'),
            components: path.join(__dirname, 'src/components'),
            static: path.join(__dirname, 'src/static'),
            images: path.join(__dirname, 'src/assets/images'),
            fonts: path.join(__dirname, 'src/assets/fonts'),
            modules: path.join(__dirname, 'src/assets/js/modules'),
        }
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                loader: 'babel-loader',
            },
            {
                test: /\.(css|scss)$/,
                use: [
                    'style-loader',
                    MiniCssExtractPlugin.loader,
                    {
                        loader: 'css-loader',
                        options: {
                            sourceMap: !isProduction
                        }
                    },
                    {
                        loader: 'postcss-loader',
                        options: {
                            ident: 'postcss',
                            sourceMap: !isProduction,
                            plugins: (loader) => [
                                require('autoprefixer')({
                                    browsers: '> 5%'
                                }),
                                require('css-mqpacker')({
                                    sort: true
                                })
                            ]
                        }
                    },
                    {
                        loader: 'sass-loader',
                        options: {
                            sourceMap: !isProduction,
                            outputStyle: isProduction && 'compressed',
                            includePaths: [
                              path.resolve(__dirname, './src/assets/scss'),
                            ],
                        }
                    }

                ]
            },
            {
                test: /\.(gif|png|jpe?g|svg)$/i,
                exclude: /(a-z A-Z 0-9)*\/(font?s)\//,
                use: [{
                        loader: 'file-loader',
                        options: {
                            name: '[name].[ext]',
                            outputPath: 'assets/images',
                            publicPath: '../images'
                        },
                    },
                    {
                        loader: 'image-webpack-loader',
                        options: {
                            bypassOnDebug: true,
                        },
                    },
                ],
            },
            {
                test: /\.(eot|ttf|svg|woff|woff2)$/i,
                exclude: /(a-z A-Z 0-9)*\/(img|image?s)\//,
                use: [{
                    loader: 'file-loader',
                    options: {
                        name: '[name].[ext]',
                        outputPath: 'assets/fonts',
                        publicPath: '../fonts'
                    },
                }],
            },
        ],
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: 'assets/css/app.css'
        })
    ]
};



/* -----------------------------------------------------------------------------
 * Dev Config
 */

if (!isProduction) {
    module.exports = merge(common, {
        mode: 'development',
        devtool: 'source-map'
    });
}


/* -----------------------------------------------------------------------------
 * Prod Config
 */

if (isProduction) {
    module.exports = merge(common, {
        mode: 'production',
        optimization: {
            minimizer: [
                new UglifyJSPlugin({
                    parallel: true,
                    uglifyOptions: {
                        output: {
                            comments: false
                        }
                    }
                })
            ],
        }
    });
}
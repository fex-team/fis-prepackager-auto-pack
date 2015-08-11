# fis3-prepackager-autopack

FIS3针对后端模板的项目静态资源自动打包插件，支持 **静态代码分析** 和 **动态统计分析** 两种自动打包方式。


## 快速使用

安装插件

```
npm install [-g] fis3-prepackager-autopack 
```

添加配置

    $ vi path/to/project/fis-conf.js

```javascript
fis.match('::package', {
    prepackager: fis.plugin('autopack')
})
```

## 打包方式

### 静态代码分析

插件默认采取静态代码分析的方式，扫描当前模块各个页面(带有isPage属性的模板)依赖的所有资源，根据使用情况计算资源合并配置。但需要注意的是对于common模块此方式不支持，因为common模块需要编译整站所有模块才能获取资源被引用的情况。


### 动态统计分析

动态统计分析根据线上日志统计获取整站所有资源的使用情况，计算整站资源合并最优配置。依赖于提供服务定时计算所有模块的合并配置。

基于统计的自动打包方案可以根据[此项目](https://github.com/fex-team/autopack-kernel)说明实施。

配置方式如下：

```javascript
fis.match('::package', {
    prepackager: fis.plugin('autopack',{
        type : 'log', //获取配置方式
        api  : 'http://youapi', //获取自动打包配置的api
        params : {}  //传递给api的参数，可自定义，默认包括模块 module字段
    })
})
```

接口返回格式要求:

```json
{
    "status" : "success" //返回状态，success等于成功
    "data"   : {} ,  //打包配置
    "msg"    : "error msg" 错误消息
}

```

您也可以根据此插件重新开发符合自己需求的基于统计的自动打包插件。

## 参数说明

默认为基于代码分析的自动打包，不需要填写任何参数

```javascript
fis.match('::package', {
    //打包前获取自动打包配置
    prepackager: fis.plugin('autopack',{

        /***以下为基于统计的自动打包配置***/

        //log/simple获取配置方式，默认为simple
        type : 'log', 

        //获取模块自动打包配置的api接口，仅在基于统计的自动打包方式下使用
        api  : 'http://youapi', 

        //传递给api的参数，可自定义，默认包括模块 module字段,与api一起使用
        params : {}  


        /**以下为打包模块参数，均为可选具体可以查看[项目文档](https://github.com/fex-team/autopack-kernel)**/

        //pc/mobile,不同终端计算rtt和speed参数默认值不一样
        platform : "pc" , 

        //rtt时间，pc端默认0.1s ,移动端默认0.5s，越小包个数越多
        rtt : 0.1 , 

        //下载速率KB/s,pc端默认100KB/s,移动端默认，越大包个数越小
        speed : 100, 

        //计算自动打包配置的资源类型，默认为js和css
        staticType ： ['js','css'],

        //资源分组依据，默认根据同步异步(loadType)分别打包，另外支持优先级priority
        //如果设置[]，则不进行任何区分
        partKeys: ['loadType','priority'] , 

        //自定义打包配置，控制特定资源的打包方式，默认为空
        //注意配置不支持正则，推荐用glob
        defaultPack: {
            '/static/pkg/aio.css' : [
                '**.css' 
            ]
        },

        //基础资源配置，这些资源将按指定顺序打在包的最前面
        //支持文件名和全路径配置
        baseResources: ['mod.js','require.js','esl.js','/lib/css/bootstrap.css']

    })
})
```


**其他说明**

FIS编译流程是同步的，如何在编译过程中获取后端服务的API结果？

mac下使用的http-sync(通过扩展支持同步)模块，win/linux下改用的http-sync-win模块(通过本地写文件模拟同步)


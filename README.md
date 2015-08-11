# fis3-prepackager-autopack

FIS3针对后端模板的项目静态资源自动打包插件，支持 **静态代码分析** 和 **动态统计分析** 两种自动打包方式。


## 快速使用

    $ vi path/to/project/fis-conf.js

```javascript
fis.match('::package', {
    //打包前获取自动打包配置
    prepackager: fis.plugin('autopack')
})
```

## 配置说明

### 静态代码分析

插件默认采取静态代码分析的方式，扫描当前模块各个页面(带有isPage属性的模板)依赖的所有资源，根据使用情况计算资源合并配置。但需要注意的是对于common模块此方式不支持，因为common模块需要编译整站所有模块才能获取资源被引用的情况。


### 动态统计分析

动态统计分析根据线上日志统计获取整站所有资源的使用情况，计算整站资源合并最优配置。依赖于提供服务定时计算所有模块的合并配置。

基于统计的自动打包方案可以根据[此项目](https://github.com/fex-team/autopack-kernel)说明实施。


插件配置方式如下：

```javascript
fis.match('::package', {
    //打包前获取自动打包配置
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
    'status' : 'success' //返回状态，success等于成功
    'data'   : {} ,  //打包配置
    'msg'    : 'error msg' 错误消息
}
```

您也可以根据此插件重新开发符合自己需求的基于统计的自动打包插件。

### 参数说明

**type**

获取配置方式，默认为`simple`(基于代码依赖分析的打包)，基于统计的为`log`

**api**

获取模块自动打包配置的api接口，仅在基于统计的自动打包方式下使用

**params**

object, 传递给后端api的参数，与api一起搭配使用

**打包参数**

打包参数为autopack-kernel模块的参数，全部为可选。具体可以查看[项目文档](https://github.com/fex-team/autopack-kernel)。主要包括：

 - platform : pc/mobile,不同终端计算参数有差别，默认为pc，可选
 - rtt : 计算自动打包的rtt时间，默认pc为0.1s，可选
 - speed : 计算资源下载速率的参数，默认pc为100KB/s ，可选
 - staticType : 计算自动打包的资源类型，默认为['js','css']，可选
 - partKeys： 资源分组方式，可选。默认区分同步异步分组['loadType'],另外支持区分优先级分组['priority']
 - defaultPack：自定义打包配置，用于手动定义某些资源的打包方式，只支持字符串或glob方式，可选
 - baseResources： 基础资源，数组方式。打包将按照此数组资源的**顺序**将基础资源打在包的最前面


**其他说明**

FIS编译流程是同步的，如何在编译过程中获取后端服务的API结果？

mac下使用的http-sync(通过扩展支持同步)模块，win/linux下改用的http-sync-win模块(通过本地写文件模拟同步)


/*
 * fis
 * http://fis.baidu.com/
 * 2014/4/11
 */

'use strict';

var gzip = require('gzip-js');
var AdmZip = require('adm-zip');
var File = require(__dirname + "/file.js");
var fs = require('fs');
var util  = require(__dirname + "/../lib/util.js");

var commentRegex = /{%\*(.|\n)*?\*%}/g;

var tagRegexs = {
    "extends": [

        // smarty tpl
        {
            regex:/([{|<]%\s?extends\s.*?%[}|>])/g,
            property:/\s?file\s?=\s?('|")(.*?)\1/
        },

        // velocity vm
        {
            regex:/(#extends\s*\(.*?\))/ig,
            property:/('|")(.*?)\1/
        }
    ],

    "widget": [

        // smarty tpl
        {
            regex:/([{|<]%\s?widget\s.*?%[}|>])/g,
            property:/\s?name\s?=\s?('|")(.*?)\1/
        },

        // velocity vm
        {
            regex:/(#widget\s*\(.*?\))/ig,
            property:/('|")(.*?)\1/
        }
    ],

    "require": [

        // smarty tpl
        {
            regex: /([{|<]%\s?require\s.*?%[}|>])/g,
            property: /\s?name\s?=\s?('|")(.*?)\1/
        },

        // velocity vm
        {
            regex:/(#require\s*\(.*?\))/ig,
            property:/('|")(.*?)\1/
        }
    ]
};

var pagePathReg = /(.*?)\/(.*)\/(.*\.tpl)/;

var pageAnalyzer = function(module,src,mapJson){
    var workingPage = {};
    var donePage = {};
    var depsTable = {};
    var handleingDeps = {};

    var resourceMap = getResource(mapJson);




    function getStaticResourceByDeps(selfID, deps){
        var staticSyncPool = [];
        var staticAsyncPool = [];
        var all = deps['widget'].concat(deps['extends']);
        //push page it self to all to handle deps
        all.push(selfID);
        all.forEach(function(id){
            var childDeps = getStaticDepsFromMapJson(id);
            staticSyncPool = staticSyncPool.concat(childDeps.sync);
            staticAsyncPool = staticAsyncPool.concat(childDeps.async);
        });
        deps['require'].forEach(function(id){
            //push require it self to sync pool
            staticSyncPool.push(id);
            var childDeps = getStaticDepsFromMapJson(id);
            staticSyncPool = staticSyncPool.concat(childDeps.sync);
            staticAsyncPool = staticAsyncPool.concat(childDeps.async);
        });
        return {
            sync:staticSyncPool.filter(unique),
            //exclude async resource from sync resource
            async:staticAsyncPool.filter(unique).filter(function(value){
                return staticSyncPool.indexOf(value) == -1;
            })
        };

        function getStaticDepsFromMapJson(id){
            var result = {
                'sync' : [],
                'async' : []
            };
            if (resourceMap[id]){
                result['sync'] = resourceMap[id]['deps']['deps'] || [];
                result['async'] = resourceMap[id]['deps']['async'] || [];
            }
            return result;
        }
    }

    function getStaticResource(pageConf){
        var deps = getRecursiveDeps(pageConf);
        return getStaticResourceByDeps(pageConf.id, deps);
    }



    /**
     * get deps module recursively
     * @param pageConf
     */
    function getRecursiveDeps(pageConf){
        fis.log.debug('analyze tpl [' + (pageConf.id || pageConf) + ']');
        var result = getCurrentDeps(pageConf);
        //fix for-loop length to prevent recall new widget analyze
        for (var i= 0, length = result['widget'].length; i < length; i++){
            var widget = result['widget'][i];
            fis.log.debug('call widget tpl [' + widget + '] analyze from [' + (pageConf.id || pageConf) + ']');
            //console.log('call widget tpl [' + widget + '] analyze from [' + (pageConf.id || pageConf) + ']');
            var widgetModule = getRecursiveDeps(widget);

            arrayMerge(result['widget'], widgetModule['widget']);
            arrayMerge(result['require'], widgetModule['require']);
        }
        result['extends'].forEach(function(page){
            fis.log.debug('call extends tpl [' + page + '] analyze from [' + (pageConf.id || pageConf) + ']');
            var pageModule = getRecursiveDeps(page);
            arrayMerge(result['widget'], pageModule['widget']);
            arrayMerge(result['require'], pageModule['require']);
        });
        return result;

        function arrayMerge(array1, array2){
            array2.forEach(function(item){
                if (array1.indexOf(item) != -1){
                    return true;
                }
                fis.log.debug(['put [', item, '] into [', pageConf.id||pageConf,']'].join(''));
                array1.push(item);
            });
        }
    }

    /**
     * analyze tpl, get widget & require & extends module (no recursive)
     * @param page
     */
    function getCurrentDeps(pageConf){
        if("string" == typeof pageConf){
            fis.util.map(src,function(id,val){
                if(val.id == pageConf){
                    pageConf = val;
                    return;
                }
            })
        }
        if (!pageConf){
            return {
                "extends": [],
                "widget": [],
                "require": []
            }
        }
        var path = pageConf.url;
        if (donePage[path]){
            return donePage[path];
        }
        var data = pageConf['_content'];
        donePage[path] = getCurrentDepsByContent(data, pageConf.id);
        workingPage[path] = null;
        return donePage[path];

    }

    /**
     * analyze tpl content to get require, widget, extends deps
     * @param content
     * @param exclude
     * @returns {{}}
     */
    function getCurrentDepsByContent(content, exclude){
        if (exclude instanceof Array == false){
            exclude = [exclude||""];
        }
        content = String(content).replace(/\n|\s\s+/g," ").replace(commentRegex,'');
        var result = {};
        var match;
        //find {%widget name='.*'%} {%require name='.*'%} {%extends file='.*'%}
        fis.util.map(tagRegexs, function(tag, regexConf){
            result[tag] = [];

            if (!Array.isArray(regexConf)) {
                regexConf = [regexConf];
            }


            regexConf.forEach(function(regexConf) {
                var regex = regexConf.regex;
                //get target
                while(match = regex.exec(content)) {
                    //get property
                    var propMatch = match[1].match(regexConf.property);
                    if (!propMatch || propMatch.length <3)
                        continue;
                    var id = propMatch[2];
                    //format extends path
                    if (tag === 'extends'){
                        //extends file need trans to resource id
                        id = id.replace(pagePathReg, function(input, namespace, path, file){
                            return [namespace, ":", path, "/", file].join('');
                        });
                    }
                    //remove self require
                    if (exclude.indexOf(id) != -1)
                        continue;
                    //remove duplicate
                    if (result[tag].indexOf(id) != -1)
                        continue;

                    result[tag].push(id);
                }
            })
        });
        return result;
    }

    function unique(value, index, self){
        return self.indexOf(value) === index;
    }


    function mergeDeps(deps1, deps2){
        if(deps1["deps"] || deps2["deps"]){
            deps1["deps"] = deps1["deps"] ? deps1["deps"].concat(deps2["deps"]) : deps2["deps"].concat(deps1["deps"]);
        }
        if(deps1["async"] || deps2["async"]){
            deps1["async"] = deps1["async"] ? deps1["async"].concat(deps2["async"]) : deps2["async"].concat(deps1["async"]);
        }
        return deps1;
    }


    /**
     * 递归获取一个文件依赖的所有资源
     * @param file : 文件id, 例如 ： addr:page/list.tpl
     * @param filetype : 文件的类型, async, deps ， deps表示同步，由于历史原因修改起来比较困难暂不修改
     * @param files : 所有的文件
     * @param {Boolean} save : 是否存贮
     * @returns {*} :  返回依赖的数组
     * @private
     */
    function _getDeps(file, filetype, files, save){
        var deps = {};
        if(handleingDeps[file]){
            return {};
        }else if(depsTable[file] ){
            return depsTable[file];
        }else{
            var fileinfo = files[file];
            handleingDeps[file] = true;
            if(fileinfo){
                if(fileinfo["deps"]){
                    for(var i=0; i<fileinfo["deps"].length; i++){
                        deps = mergeDeps(deps, _getDeps(fileinfo["deps"][i], "deps", files, deps, false));
                    }
                    if(filetype != "async"){
                        if(deps["deps"]){
                            deps["deps"] = deps["deps"].concat(fileinfo["deps"]);
                        }else{
                            deps["deps"] = fileinfo["deps"];
                        }
                    }else{
                        if(deps["async"]){
                            deps["async"] = deps["async"].concat(fileinfo["deps"]);
                        }else{
                            deps["async"] = fileinfo["deps"];
                        }
                    }
                }
                if(fileinfo["extras"] && fileinfo["extras"]["async"]){
                    for(var i=0; i<fileinfo["extras"]["async"].length; i++){
                        deps = mergeDeps(deps, _getDeps(fileinfo["extras"]["async"][i], "async",  files, false));
                    }
                    if(deps["async"]){
                        deps["async"] = deps["async"].concat(fileinfo["extras"]["async"]);
                    }else{
                        deps["async"] = fileinfo["extras"]["async"];
                    }
                }
            }
            if(deps["deps"]){
                deps["deps"] =  util.array_unique(deps["deps"]);
            }
            if(deps["async"]){
                deps["async"] = util.array_unique(deps["async"]);
            }
            if(save){
                depsTable[file] = deps;
            }
            handleingDeps[file] = false;
            return deps;
        }
    }


    function getStaticSize(fileId){
        var size = 0;
        for(var file in src){
            if(src[file]["id"] == fileId ){
                var timestamp = +new Date;
                var content = src[file]['_content'],
                    options = {
                        level: 6,
                        timestamp: parseInt(Date.now() / 1000, 10)
                    },
                    out = gzip.zip(content, options),
                    bakFile = __dirname + "/temp/"+ timestamp + "/" + file;

                util.write(bakFile, new Buffer(out));

                var stat = fs.statSync(bakFile);
                size = stat["size"];
                break;
            }
        }
        util.del(__dirname + "/temp/" + timestamp);
        return size;
    }

    /**
     * 分析map.json，获取所有资源的依赖信息
     * @returns {{}}
     */
    function getResource(configRes){
        var files = {};
        for(var fileId in configRes){
            if(configRes.hasOwnProperty(fileId)){
                var fileProperty = configRes[fileId];
                var filesize = getStaticSize(fileId);
                var deps = [];

                //获取资源依赖关系
                if(depsTable[fileId]){
                    deps = depsTable[fileId];
                }else{
                    deps = _getDeps(fileId, "deps", configRes, true);
                }
                files[fileId] = new File(fileId, fileProperty["type"], "", fileProperty["uri"], filesize, deps);
            }
        }
        return files;                                              T
    }

    /**
     * 计算各个资源的使用次数
     * @param configRes
     * @param resource
     */
    function calResourcePV(weights){
        for(var fileId in src){
            var pageConf = src[fileId];
            if(pageConf['extras'] && pageConf['extras']['isPage']){
                var statics = getStaticResource(pageConf);
                var syncStatics = statics['sync'];
                var asyncStatics = statics['async'];

                //获取当前页面的权重
                var weight = 1; //默认为1;
                for(var id in weights){
                    if(fileId.indexOf("/"+id) != -1){
                        weight = weights[id];
                        break;
                    }
                }
                //模板PV
                if(resourceMap[pageConf['id']]){
                    resourceMap[pageConf['id']].addPv(weight);
                }

                var pageHash = fis.util.md5(pageConf["id"]);
                for(var j=0; j<syncStatics.length; j++){
                    var resource = resourceMap[syncStatics[j]];
                    if(resource){
                        resource.addPage(pageHash, weight);
                        resource.addPv(weight);
                        resource.setLoadType("sync");
                    }
                }
                for(var k=0; k<asyncStatics.length; k++){
                    var resource = resourceMap[asyncStatics[k]];
                    if(resource){
                        resource.addPage(pageHash, weight);
                        resource.addPv(weight);
                        resource.setLoadType("async");
                    }
                }
            }
        }

        return resourceMap;
    }

    function createCSV(resources){
        var pages = [];
        for(var i in mapJson){
            if(mapJson[i]["extras"] && mapJson[i]["extras"]["isPage"] && pages.indexOf(i)<0 ){
                pages.push(i)
            }                    i
        }
        var csvAllHeader = " ,",
            csvAllBody = "";

        for(var i=0; i<pages.length; i++){
            csvAllHeader += pages[i] +  ",";
        }

        for(var id in resources){
            var resource = resources[id];
            if(resource.get("type") == "js" || resource.get("type") == "css"){
                csvAllBody += resource.get("id") + "_" + resource.get("pv");
                for(var j=0; j<pages.length; j++ ){
                    var hash = fis.util.md5(String(pages[j]));
                    if(resource.get("pages")[hash]  > -1 ){
                        csvAllBody += ",1";
                    }else{
                        csvAllBody += ", ";
                    }
                }
                csvAllBody += "\n";
            }
        }
        return csvAllHeader + "\n" + csvAllBody;
    }

    return {
        getRecursiveDeps:getRecursiveDeps,
        getCurrentDeps:getCurrentDeps,
        getCurrentDepsByContent:getCurrentDepsByContent,
        getStaticResource:getStaticResource,
        getStaticResourceByDeps:getStaticResourceByDeps,
        getResource :  getResource,
        calResourcePV : calResourcePV,
        createCSV : createCSV
    }
};

module.exports = pageAnalyzer;

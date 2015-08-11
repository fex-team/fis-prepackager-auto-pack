
var autoPackger = require('autopack-kernel');
var request = require("../lib/request-sync");
var colors = require( "colors");

/**
 * 扫描代码计算自动打包配置
 * @param  {[type]} files       [description]
 * @param  {[type]} mapJson     [description]
 * @param  {[type]} module      [description]
 * @param  {[type]} projectPath [description]
 * @param  {[type]} settings    [description]
 * @return {[type]}             [description]
 */
function getSimplePackResult(files,mapJson,module,projectPath,settings){
    var pageAnalyzer = require("../analyzer/pageAnalyzer.js");
    //页面权重
    var weights = settings.weights || {};
    var analyzer = new pageAnalyzer(module,files,mapJson);
    var resources = analyzer.calResourcePV(weights);
    
    //debug
    fis.util.write(projectPath + "/resource.json",JSON.stringify(resources,null,4));
    fis.util.write(projectPath + "/resource.csv",analyzer.createCSV(resources));

    //获取打包配置
    var packConf = autoPackger.pack(resources,settings);
    fis.util.write(projectPath + "/fis-pack.json",JSON.stringify(packConf,null,4));
    return packConf;    
}


/**
 * 调用服务获取基于统计的自动打包配置
 * @param  {[type]} module      [description]
 * @param  {[type]} projectPath [description]
 * @param  {[type]} settings    [description]
 * @return {[type]}             [description]
 */
function getLogPackResult(module,projectPath,settings,opt){
    var api = settings['api'] || "http://solar.baidu.com/autopack";
    //api参数，模块为必须字段
    var params = settings['params'] || {};
    api += "?module=" + module; //模块信息
    //兼容之前fid配置
    if(settings['fid']){
        params['fid'] = settings['fid'];
        params['svn'] = module;
    }
    fis.util.map(params,function(key,val){
        api += "&" + key + "=" + String(val);
    })

    var packConf = {};

    //通过api同步(编译不支持异步)获取打包配置
    var json = {
        'status' : 'error' 
    }; 
    var confFile = projectPath + "/pack.json";   
    try{
        var response  = request(api);
        var body      = response['body'];
        json          = JSON.parse(body);
    }catch(e){
        json['msg'] = e;
    }
    if(json['status'] == "success"){
        //json转成字符串并自动格式化
        packConf = json['data'];
        var jsonStr = JSON.stringify(json['data'], null, 4);
        
        //同步写入字符串信息,简单根据长度判断正常      
        if(jsonStr.length > 20 && (!opt['watch'] || !fis.util.exists(confFile)) ){
            fs.writeFileSync(pconfFile,jsonStr);
        }            
        if(json['msg'] !=""){
            fis.log.notice(json['msg']); 
        }
        fis.log.notice("[AutoPack] get AutoPack result success.................");                                  
    }else{
        //获取自动打包失败，沿用上次打包结果
        fis.log.warning("[autopack] get pack conf error".red + json['msg'] ); 
        if(fis.util.exists(confFile)){
            packConf = fis.util.readJSON(confFile);  
        }                
    }
    return packConf;
}


/**
 * 根据配置从简版或者云服务获取自动打包配置
 * @param  {[type]} type [description]
 * @param  {[type]}      [description]
 * @return {[type]}      [description]
 */
module.exports.getAutoPack = function(ret,module,root,settings,opt){
    var packConf = {};
    var type = settings['type'] || "simple";
    if(type == "simple"){
        packConf = getSimplePackResult(ret.src,ret.map.res,module,root,settings);
    }else{
        packConf = getLogPackResult(ret.src,ret.map.res,module,root,settings,opt);
    }
    return packConf;
}
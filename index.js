/*
 * fis
 * http://fis.baidu.com/
 */

'use strict';

var autoPacker = require("./pack/autopack.js");

var _ = fis.util;

module.exports = function(ret, pack, settings, opt) {
  var ns   = fis.config.get('namespace');
  var root = fis.project.getProjectPath();

  /***************获取自动打包配置********************/
  var autoPack = autoPacker.getAutoPack(ret,ns,root,settings,opt); 
  

  //不考虑exclude，如需定制css通过自定义配置实现
  _.map(pack,function(idx,val){
    delete pack[idx];
  })
 
  _.map(autoPack,function(idx,val){
      pack[idx] = val;
  })

  console.log(JSON.stringify(pack,null,4));
};

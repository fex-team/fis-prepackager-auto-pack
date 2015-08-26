/**
 * 识别用户系统决定是否安装同步请求插件
 */

var isMac = /^darwin/.test(process.platform);
var cp = require('child_process');

//mac下安装http-sync模块发起同步请求
//默认的http-sync-win只在windows下有效
if(isMac){
    install("http-sync","0.1.2");
}


function install(packageName,version){ 
    var cmd = "sudo npm install " + packageName + "@" + version;
    console.log("sudo install "+ packageName + " on mac. please wait.... ");
    cp.exec(cmd ,function(err, stdout, stderr){
        console.log(stdout);
        if(err){        
            console.log(stderr);
        }
    })
}

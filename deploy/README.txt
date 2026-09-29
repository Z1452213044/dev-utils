开发者工具箱：免配置服务器发布包
================================

一、上传并解压

  tar -xzf DeveloperToolbox-server-20260924-final.tar.gz
  cd DeveloperToolbox-server

二、启动

  ./start.sh

默认监听：0.0.0.0:8080
访问地址：http://服务器IP:8080

三、常用命令

  ./start.sh status    查看状态
  ./start.sh logs      查看实时日志
  ./start.sh restart   重启
  ./start.sh stop      停止

四、可选端口覆盖

通常不需要修改。如端口确实被占用，可临时指定：

  DEVELOPER_TOOLBOX_PORT=49527 ./start.sh

五、运行环境

启动脚本会自动选择服务器已有的运行环境：

1. 优先使用 Python 3.6 或更高版本；
2. 没有 Python 时自动使用 Node.js；
3. 二者安装任意一个即可，不需要 npm install，也不需要安装项目依赖。

六、服务器端口

如果无法访问，请确认代理网关、安全组或防火墙已经放行 TCP 8080。

本发布包默认提供 HTTP 服务。普通网页功能可以正常使用；PWA 安装、离线缓存和
Service Worker 在公网环境通常要求 HTTPS。

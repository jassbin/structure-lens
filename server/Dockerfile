# 照妖镜小程序后端 Dockerfile（云托管容器）
# 构建后直接 npm start 启动 Express 服务，监听 80 端口
FROM node:20-alpine

WORKDIR /app

# 安装 curl（联网检索回退依赖；云函数原始实现用系统 curl，这里保留）
RUN apk add --no-cache curl

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=80
EXPOSE 80

CMD ["npm", "start"]
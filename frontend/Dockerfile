# مرحله ۱: ساخت پروژه
FROM node:18 AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# اول build را انجام بده
RUN npm run build

# سپس محتوای پوشه app را بعد از build ببین
RUN ls -la /app

# مرحله ۲: اجرا با Nginx
FROM nginx:1.25-alpine

RUN rm -rf /usr/share/nginx/html/*

# سعی کن اول dist را کپی کنی، اگر نشد build را امتحان کن
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
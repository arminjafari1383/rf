# مرحله ۱: ساخت پروژه
FROM node:18 AS build
WORKDIR /app

# کپی package files
COPY package*.json ./

# نصب وابستگی‌ها
RUN npm install

# کپی تمام کدهای پروژه
COPY . .

# ساخت پروژه
RUN npm run build

# مرحله ۲: اجرا با Nginx
FROM nginx:1.25-alpine

# حذف فایل‌های پیش‌فرض
RUN rm -rf /usr/share/nginx/html/*

# فقط یک خط COPY - پوشه درست را انتخاب کن:
# اگر پروژه Vue/Angular (dist):
COPY --from=build /app/dist /usr/share/nginx/html

# یا اگر پروژه React (build):
# COPY --from=build /app/build /usr/share/nginx/html

# پورت
EXPOSE 80

# اجرای Nginx
CMD ["nginx", "-g", "daemon off;"]
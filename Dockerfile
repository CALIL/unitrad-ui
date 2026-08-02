FROM node:25
RUN npm install
COPY ./ /js/
WORKDIR /js/
RUN yarn install
RUN npm test
CMD ["npm", "test"]

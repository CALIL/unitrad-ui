FROM node:10
RUN npm install -g yarn
RUN yarn install
RUN npm test
COPY ./ /js/
WORKDIR /js/
CMD ["npm", "test"]

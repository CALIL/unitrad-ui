FROM node:10
RUN npm install -g yarn
COPY ./ /js/
WORKDIR /js/
RUN yarn install
RUN npm test
CMD ["npm", "test"]

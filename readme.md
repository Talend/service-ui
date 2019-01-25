# Report Portal service-ui for Talend

## Talend Customizations

- Automatic Slack message generation for daily reports

## Installation

### Prerequisite

Need to run all the Report Portal services except the service-ui.

### Steps to install

1. Install nodejs

2. Open console from the project root

3. run the command `cd src/main/resources/public`

4. run the command `npm install`

5. run the command `npm run grunt`

6. create file `config-proxy.js` in `public` folder

```javascript
module.exports = {
    path: ''  //     http://you_server:port/
};
```

7. open new console from the project root

8. run the command `cd src/main/resources/public`

9. run the command `npm run server`

10. open `https://localhost:8080/` in browser

const https = require('https');

https.get('https://multitaskagency.com', (res) => {
  let html = '';
  res.on('data', (d) => html += d);
  res.on('end', () => {
    const match = html.match(/src="\/assets\/index-([^"]+)\.js"/);
    if (match) {
      const jsUrl = 'https://multitaskagency.com/assets/index-' + match[1] + '.js';
      console.log('Fetching JS:', jsUrl);
      https.get(jsUrl, (jsRes) => {
        let jsData = '';
        jsRes.on('data', (d) => jsData += d);
        jsRes.on('end', () => {
          console.log('JS length:', jsData.length);
          console.log('Contains website_data?', jsData.includes('website_data'));
        });
      });
    } else {
      console.log('No JS bundle found in HTML.');
    }
  });
});

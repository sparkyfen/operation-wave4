'use strict';
var aws2 = require('aws2');
var qs = require('querystring');
var DataObjectParser = require('dataobject-parser');
var request = require('request').defaults({
  headers: {
    'User-Agent': 'Operation-Wave4/v0.1',
    'Accept': 'text/xml, */*'
  }
});
var parser = require('xml2json', {
  sanitize: false
});
var config = require('./config');
var client = require('twilio')(config.twilio.sid, config.twilio.authToken);

var usHost = config.amazon.us.host;
var canadaHost = config.amazon.ca.host;
var usMarketplace = config.amazon.us.marketplace;
var canadaMarketplace = config.amazon.ca.marketplace;
var usSellerId = config.amazon.us.sellerId;
var canadaSellerId = config.amazon.ca.sellerId;
var usMwsAccessKey = config.amazon.us.accessKey;
var canadaMwsAccessKey = config.amazon.ca.accessKey;
var usMwsSecretKey = config.amazon.us.secretKey;
var canadaMwsSecretKey = config.amazon.ca.secretKey;

var asinList = ['B00V86BJV4', 'B00V86BRHU', 'B00V86C4LS', 'B00V86BRK2', 'B00V86BJX2', 'B00VHWMKEY', 'B00VHWMJWC', 'B00VHWMK44'];
var productData = {
  ASINList: {
    ASIN: {}
  },
  Action: 'GetMatchingProduct',
  MarketplaceId: usMarketplace,
  SellerId: usSellerId,
  Version: '2011-10-01'
};
for (var i = 0; i < asinList.length; i++) {
  var ASIN = asinList[i];
  productData.ASINList.ASIN[i + 1] = ASIN;
}
productData = DataObjectParser.untranspose(productData);
var options = {
  host: usHost,
  path: '/Products/2011-10-01/?' + qs.stringify(productData)
};

var inter = setInterval(function () {
  console.log('Calling Amazon for Wave 4.');
  aws2.sign(options, {
    accessKeyId: usMwsAccessKey,
    secretAccessKey: usMwsSecretKey
  });
  request.get('https://' + options.host + options.path, {
    headers: options.headers
  }, function (error, response, body) {
    if(error) {
      return console.log(error);
    }
    var jsonBody = JSON.parse(parser.toJson(body));
    var items = jsonBody['GetMatchingProductResponse']['GetMatchingProductResult'];
    var releasedList = [];
    for (var i = 0; i < items.length; i++) {
      var amiibo = items[i];
      var releaseDate = amiibo['Product']['AttributeSets']['ns2:ItemAttributes']['ns2:ReleaseDate'];
      if(releaseDate !== '2015-12-31') {
        releasedList.push({
          name: amiibo['Product']['AttributeSets']['ns2:ItemAttributes']['ns2:Color'],
          releaseDate: releaseDate,
          link: 'amzn.com/' + amiibo['ASIN']
        });
        var index = asinList.indexOf(amiibo['ASIN']);
        if(index !== -1)  {
         asinList.splice(index, 1);
        }
        if(asinList.length === 0) {
          clearInterval(inter);
        }
      }
    }
    if(releasedList.length > 0) {
      var names = releasedList.map(function (amiibo) {
        return amiibo.name;
      }).join(',');
      client.sms.messages.create({
        body: names,
        to: config.twilio.to,
        from: config.twilio.from
      }, function (error, sms) {
        if(error) {
          return console.log(error);
        }
        console.log(sms);
      });
    } else {
      console.log('No new Amiibo updates :(');
    }
  });
}, 10000);
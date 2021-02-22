let cheerio = require('cheerio');
let jsonframe = require('jsonframe-cheerio');
const axios = require('axios');
var fs = require('fs');
var http = require('http');
var https = require('https');
http.globalAgent.maxSockets = 10;
https.globalAgent.maxSockets = 10;

var url = 'http://nysdoccslookup.doccs.ny.gov/GCA00P00/WIQ2/WINQ120';
var receptionCenterCodes = 'ABDGR';
var csvHeader = 'DIN,name,sex,DOB,race,custodyStatus,housing,dateReceivedOriginal,dateReceivedCurrent,admissionType,county,latestReleaseDate,latestReleaseType,minSentence,maxSentence,earliestRelaseDate,earliestRelaseType,paroleHearingDate,paroleHearingType,paroleEligibilityDate,conditionalReleaseDate,maxExpirationDate,maxExpirationDateParole,postReleaseMaxExpiration,paroleBoardDischargeDate,crime1,class1,crime2,class2,crime3,class3,crime4,class4\n'
var inmateform = {
	ID: {
		_s:"table:eq(0)",
		_d: {
			DIN: "td[headers=t1a]",
			name: "td[headers=t1b]",
			sex: "td[headers=t1c]",
			DOB: "td[headers=t1d]",
			race: "td[headers=t1e]",
			custodyStatus: "td[headers=t1f]",
			housing: "td[headers=t1g]",
			dateReceivedOriginal: "td[headers=t1h]",
			dateReceivedCurrent: "td[headers=t1i]",
			admissionType: "td[headers=t1j]",
			county: "td[headers=t1k]",
			latestReleaseDate: "td[headers=t1l]"
		}
	},
	SENTENCE: {
		_s:"table:eq(2)",
		_d: {
			minSentence: "td[headers=t3a]",
			maxSentence: "td[headers=t3b]",
			earliestRelaseDate: "td[headers=t3c]",
			earliestRelaseType: "td[headers=t3d]",
			paroleHearingDate: "td[headers=t3e]",
			paroleHearingType: "td[headers=t3f]",
			paroleEligibilityDate: "td[headers=t3g]",
			conditionalReleaseDate: "td[headers=t3h]",
			maxExpirationDate: "td[headers=t3i]",
			maxExpirationDateParole: "td[headers=t3j]",
			postReleaseMaxExpiration: "td[headers=t3k]",
			paroleBoardDischargeDate: "td[headers=t3l]"
		}
	},
	CRIME: {
		_s:"table:eq(1) tr:has(td)",
		_d: [{
			crime: "td[headers=crime] || [^\\r|\\n|\\r\\n]*",
			class: "td[headers=class]"
		}]
	}
};
const myClient = axios.create({
  baseURL: url,
  headers: {
            'Connection': 'keep-alive',
            'Accept-Encoding': '',
            'Accept-Language': 'en-US,en;q=0.8'
        }
});

var FAILED_FETCHES = new Array();
(async () => {
	for (let year = 2020; year >= 2000; year--) {
		console.time('test');
		console.log(`starting ${year}`)
		var date = new Date(); 
		var time = "@"  
                + date.getHours() + ":"  
                + date.getMinutes() + ":" 
                + date.getSeconds();
		const outcsv = fs.createWriteStream(`data/inmates${year}${time}.csv`);
		outcsv.write(csvHeader);
		for (let r = 0; r < receptionCenterCodes.length; r++) {
			var prefix = year.toString().slice(-2) + receptionCenterCodes.charAt(r);
			for (let offset = 0; offset < 9999; offset += 100) {
				var fetchPromises = [...Array(100)].map((_,i) => {
					if (offset >= 1000) {
						var din = prefix + (offset+i+1);
					} else {
						var din = prefix + (offset+i+1).toString().padStart(4,'0');
					}
					return scrapeDIN(din);
				});
				var fetched = await Promise.all(fetchPromises);
				var csvs = '';
				var misses = new Array();
				fetched.forEach((res,i) => {
					if (res) {
						csvs += res;
					} else {
						misses.push(i);
					}
				});
				outcsv.write(csvs);
				
				if (misses.length >= 5 && misses[misses.length-1] == 99 && misses[misses.length-5] == 95) {
					break;
				}
				await sleep(500);
			}
		}
		console.timeEnd('test');
		await sleep(60000);
	}
	if (FAILED_FETCHES) {
		console.log(FAILED_FETCHES);
	}
})();

// input: din number
// return: csv representation of din's data
async function scrapeDIN(din) {
	try {
		var res = await fetchDINResponse(din);
		return parseHTML(res.data);
	} catch (err) {
		console.error(err);
		FAILED_FETCHES.push(din);
		return null;
	}
}

// input: din number
// try fetching res, 5 retries with increasing timeouts
// return: http response from NYDOC server
async function fetchDINResponse(din) {
	var tries = 0;
	var retryTimes = 5;
	var touts = [10000,10000,20000,100000,100000];
	async function run() {
		try {
			const data = {
				K01: 'WINQ120',
				M12_SEL_DINI: din
			};
			var res = await myClient.post('', new URLSearchParams(data), {timeout: touts[tries]});
			return res;
		} catch (err) {
			tries++;
			if (tries >= retryTimes) {
				throw new Error(`Fetching ${din} failed after ${retryTimes} attempts`);
			} else {
				if (err.code != 'ECONNABORTED') {
					console.log(`ERROR: ${err.code} RETRYING ${din}`);
				}
				return run();
			}
		}
	}
	return run();
};

// input: html response from NYDOC server
// parse data into json, reformat data, flatten to csv
// return: csv representation of din's data
function parseHTML(html) {
	if (!/headers="t1a"/.test(html) || /NOT ON LOCATOR/.test(html)) {
		return null;
	}
	let $ = cheerio.load(html);
	jsonframe($);
	var inmate = $('#content').scrape(inmateform)
	inmate.ID.name = inmate.ID.name.replace(/(.*),\s*(.*)/,'$2 $1')
	inmate.ID.latestReleaseDate = parseLatestReleaseDate(inmate.ID.latestReleaseDate);
	inmate.SENTENCE.minSentence = parseSentence(inmate.SENTENCE.minSentence)
	inmate.SENTENCE.maxSentence = parseSentence(inmate.SENTENCE.maxSentence)
	for (let c of inmate.CRIME) {
		c.crime = c.crime.replace(/,/g,' ')
	}
	return flattenCSV(inmate);
}

// input: latestReleaseDate in form "MM/DD/YYYY RELEASETYPE"
// return: date and type split by comma (return 1 comma if empty)
function parseLatestReleaseDate(s) {
	if (s.length < 6) {
		return ',';
	}
	return s.replace(/\s/,',')
}

// input: sentence in form "YYYY Years, MM Months, DD Days"
// return: decimal equiv. sentence (LIFE => return 100, invalid => return undefined)
function parseSentence(s) {
	if (/LIFE/.test(s)) {
		return 100;
	}
	var nums = /\d+/g
	var num = s.match(nums)
	if (!num || num.length != 3) {
		return null;
	}
	var dur = parseInt(num[0]) + parseInt(num[1])/12 + parseInt(num[2])/365;
	dur = Math.floor((dur*100))/100;
	return dur
}

// input: inmate data in JSON format
// return: data flattened and seperated by commas
var flattenCSV = function(data) {
    var result = '';
    function recurse(cur) {
    	if (Object(cur) !== cur) {
			if (/  /.test(cur) || /^\s*$/.test(cur)) {
                result += ",";
            } else {
                result += cur + ",";
            }
    	} else if (Array.isArray(cur)) {
			for (let i of cur) {
				recurse(i);
			}
    	} else {
    		var isEmpty = true;
			for (let p in cur) {
				isEmpty = false;
				recurse(cur[p])
			}
			if (isEmpty) {
				result += ',';
			}
		}
    }
    recurse(data);
    result = result.slice(0, -1)
    result += '\n'
    return result;
}

// input: ms to wait
// return: Promise resolved in ms time
function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}   
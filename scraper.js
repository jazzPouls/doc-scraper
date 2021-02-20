let cheerio = require('cheerio');
let jsonframe = require('jsonframe-cheerio');
const axios = require('axios');
var qs = require('qs');
var fs = require('fs');
const {default: PQueue} = require('p-queue');
var sleep = require('sleep');
var http = require('http');
var https = require('https');
http.globalAgent.maxSockets = 10;
https.globalAgent.maxSockets = 10;

var url = 'http://nysdoccslookup.doccs.ny.gov/GCA00P00/WIQ2/WINQ120';
// var receptionCenterCodes = 'ABCDEGHIJNPRSTXY';
var receptionCenterCodes = 'A';
var csvHeader = 'DIN,name,sex,DOB,race,custodyStatus,housing,dateReceivedOriginal,dateReceivedCurrent,admissionType,county,latestReleaseDate,minSentence,maxSentence,earliestRelaseDate,earliestRelaseType,paroleHearingDate,paroleHearingType,paroleEligibilityDate,conditionalReleaseDate,maxExpirationDate,maxExpirationDateParole,postReleaseMaxExpiration,paroleBoardDischargeDate,crime,class,crime,class,crime,class,crime,class\n'
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
var inmateformDates = {
	ID: {
		_s:"table:eq(0)",
		_d: {
			DIN: "td[headers=t1a]",
			name: "td[headers=t1b]",
			sex: "td[headers=t1c]",
			DOB: "td[headers=t1d] < date",
			race: "td[headers=t1e]",
			custodyStatus: "td[headers=t1f]",
			housing: "td[headers=t1g]",
			dateReceivedOriginal: "td[headers=t1h] < date",
			dateReceivedCurrent: "td[headers=t1i] < date",
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
			earliestRelaseDate: "td[headers=t3c] < date",
			earliestRelaseType: "td[headers=t3d]",
			paroleHearingDate: "td[headers=t3e] < date",
			paroleHearingType: "td[headers=t3f]",
			paroleEligibilityDate: "td[headers=t3g] < date",
			conditionalReleaseDate: "td[headers=t3h] < date",
			maxExpirationDate: "td[headers=t3i] < date",
			maxExpirationDateParole: "td[headers=t3j] < date",
			postReleaseMaxExpiration: "td[headers=t3k] < date",
			paroleBoardDischargeDate: "td[headers=t3l] < date"
		}
	},
	CRIME: {
		_s:"table:eq(1)",
		_d: [{
			crime: "td[headers=crime]",
			class: "td[headers=class]"
		}]
	}
};
var inmateformSentence = {
	ID: {
		_s:"table:eq(0)",
		_d: {
			DIN: "td[headers=t1a]",
			custodyStatus: "td[headers=t1f]",
			dateReceivedOriginal: "td[headers=t1h]",
			latestReleaseDateType: "td[headers=t1l]"
		}
	},
	SENTENCE: {
		_s:"table:eq(2)",
		_d: {
			minSentence: "td[headers=t3a]",
			maxSentence: "td[headers=t3b]"
		}
	},
	CRIME: {
		_s:"table:eq(1)",
		_d: [{
			crime: "td[headers=crime]",
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
// const sample100res = fs.createWriteStream('sample100res.txt');

(async() => {

	const outcsv = fs.createWriteStream('out.csv');
	outcsv.write(csvHeader);
	const pqueue = new PQueue({concurrency: 200, autoStart: true});
	
	// const din18A = DIN(2018,'A',4900,9999);

	var count = 0;
	console.time('test');
	for (let year = 2018; year < 2019; year++) {
		for (let r = 0; r < receptionCenterCodes.length; r++) {
			const din18 = DIN(2018,receptionCenterCodes.charAt(r),4900,4950);
			var missed = new Array();
			for (const d of din18) {
				count++;
				(async () => {
					try {
						console.log('adding',d)
						var s = await pqueue.add(async () => fetchDINResponse(d));
						// var s = await fetchDINResponse(d);
						var parseResult = parseHTML(s.data,d);
						if (parseResult.success) {
							outcsv.write(parseResult.csv)					
							console.log(d,' data written to csv')
						} else {
							missed.push(parseInt(d.slice(-4)));
							missed.sort((a,b) => b-a);
							// console.log(missed)
						}
					} catch (err) {
						console.log(err.message);
						return;
					}
				})();
				if (count == 2000) {
					break;
				}
			}
		}
	}
	(async () => {
		console.log(`Size: ${pqueue.size}  Pending: ${pqueue.pending}`);
		await pqueue.onIdle();
		console.timeEnd('test');
	})();

})();

// function handleDINResponse(res,din) {
// 	var parsed = parseHTML(res.data, din);
// 	return flattenCSV(parsed);
// }

async function fetchDINResponse(DIN) {
	var tries = 0;
	var retryTimes = 5;
	console.log("fetching",DIN)
	async function run() {
		try {
			const data = {
				K01: 'WINQ120',
				M12_SEL_DINI: DIN
			};
			var res = await myClient.post('', new URLSearchParams(data));
			return res;
		} catch (err) {
			tries++;
			console.log("ERROR: " +err.code + " " +DIN);
			if (tries >= retryTimes) {
				console.log(retryTimes,' FAILED ')
				throw new Error;
			} else {
				console.log("RETRYING ", DIN)
				return run();
			}
		}
	}
	return run();
};

var parseHTML = function(html, din) {
	var res = {
		success: false,
		csv: null
	};
	if (!/headers="t1a"/.test(html)) {
		console.log(din,' not found: ',html.match(/<p class="err">(.*)<\/p>/)[1]);
		return res;
	}
	res.success = true;
	let $ = cheerio.load(html);
	jsonframe($);
	var inmate = $('#content').scrape(inmateform)
	inmate.ID.name = inmate.ID.name.replace(/(.*),\s*(.*)/,'$2 $1')
	inmate.SENTENCE.minSentence = parseSentence(inmate.SENTENCE.minSentence)
	inmate.SENTENCE.maxSentence = parseSentence(inmate.SENTENCE.maxSentence)
	for (let c of inmate.CRIME) {
		c.crime = c.crime.replace(/,/g,' ')
	}
	res.csv = flattenCSV(inmate);
	return res;
}

function* DIN(year,receptionCenterCode,start=1,end=9999) {
	var din = year.toString().slice(-2) + receptionCenterCode;
	for (var i = start; i < end; i++) {
		if (i < 1000) {
			i = i.toString().padStart(4,'0');
		}
		yield din + i.toString()
	}
}

var parseSentence = function(s) {
	if (/LIFE/.test(s)) {
		return 'LIFE';
	}
	var nums = /\d+/g
	var num = s.match(nums)
	if (!num || num.length != 3) {
		console.log('ERROR IN SENTENCE DURATION FORMAT')
		return ;
	}
	var dur = parseInt(num[0]) + parseInt(num[1])/12 + parseInt(num[2])/365
	dur = Math.floor((dur*100))/100;
	return dur
}

var flattenCSV = function(data) {
    var result = '';
    function recurse(cur) {
    	if (Object(cur) !== cur) {
    		result += cur + ',';
    	} else if (Array.isArray(cur)) {
    		if (cur.length == 0) {
    			result += ',';
    		} else {
    			for (let i of cur) {
    				recurse(i);
    			}
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
    recurse(data, "");
    result = result.slice(0, -1)
    result += '\n'
    return result;
}

function flattenCsvProperties(data) {
    var result = "";
    function recurse(cur, prop) {
        if (Object(cur) !== cur) {
            result += prop + ",";
        } else if (Array.isArray(cur)) {
            for(var i=0, l=cur.length; i<l; i++)
                 recurse(cur[i], prop + "[" + i + "]");
            if (l == 0)
                result+= ',';
        } else {
            var isEmpty = true;
            for (var p in cur) {
                isEmpty = false;
                recurse(cur[p], p);
            }
            if (isEmpty)
                result+=",";
        }
    }
    recurse(data, "");
    return result;
}


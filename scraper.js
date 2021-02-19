let cheerio = require('cheerio');
let jsonframe = require('jsonframe-cheerio');
const axios = require('axios');
var qs = require('qs');
var fs = require('fs');
var sleep = require('sleep');
var http = require('http');
var https = require('https');
http.globalAgent.maxSockets = 10;
https.globalAgent.maxSockets = 10;

var url = 'http://nysdoccslookup.doccs.ny.gov/GCA00P00/WIQ2/WINQ120';
var receptionCenterCodes = 'ABCDEGHIJNPRSTXY';
var csvHeader = 'DIN,name,sex,DOB,race,custodyStatus,housing,dateReceivedOriginal,dateReceivedCurrent,admissionType,county,latestReleaseDate,minSentence,maxSentence,earliestRelaseDate,earliestRelaseType,paroleHearingDate,paroleHearingType,paroleEligibilityDate,conditionalReleaseDate,maxExpirationDate,maxExpirationDateParole,postReleaseMaxExpiration,paroleBoardDischargeDate,crime,class,crime,class,crime,class,crime,class,'

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
})

const outcsv = fs.createWriteStream('out.csv');
// const sample100res = fs.createWriteStream('sample100res.txt');
var row = 0;

(async() => {
	// var sampleinmate = await fetchDINResponse('18A0001')
	// console.log(sampleinmate)
	// var props = flattenCsvProperties(sampleinmate)
	// console.log(props)	
	// await outcsv.write(props+'\n')

	const din18A = DIN(2018,'A');

	var count = 0;
	var inmate;
	for (const d of din18A) {
		count++;
		var html = await fetchDINResponse(d);
		parseHTML(html.data,d)
		if (count == 100) {
			break;
		}
	}

})();

// async function addInmate(din) {
// 	var res = await fetchDINResponse(din);
// 	var parsed = parseHTML(res.data, din)

// }



// var tests = ['0027']
// for (let i in tests) {
// 	getDIN('18A'+tests[i]);
// }

// for (let i = 0; i < 2; i++) {
// 	getDIN('18A'+tests[i]);
// }







async function fetchDINResponse(DIN) {
  try {
  	const data = {
		K01: 'WINQ120',
		M12_SEL_DINI: DIN
	};
    var res =  await axios.post(url, new URLSearchParams(data));
	return res
	// console.log(res)
  } catch (err) {
  	console.log("%%%%%%%% Error fetching: " + DIN)
	//   console.log(res)
	  console.error(err.code);
	
    console.log("%&%xxx&$*#(*&%^%^%%%%^^^^^ ERROR " + DIN)
  }
};



var parseHTML = function(html, din) {
	var successregex = /headers="t1a"/g;
	if (successregex.test(html)) {
		// console.log(html)
		let $ = cheerio.load(html);
		// console.time('json');
		jsonframe($); // initializes the plugin
		var inmate = $('#content').scrape(inmateform)
		// console.timeEnd('json');
		inmate.ID.name = inmate.ID.name.replace(/(\w+),\s*(\w+)/,'$2 $1')
		inmate.SENTENCE.minSentence = parseSentence(inmate.SENTENCE.minSentence)
		inmate.SENTENCE.maxSentence = parseSentence(inmate.SENTENCE.maxSentence)
		for (let c of inmate.CRIME) {
			c.crime = c.crime.replace(/,/g,' ')
		}
		console.log(flattenCsvProperties(inmate));
		outcsv.write(row++ +","+ flattenCSV(inmate));
		return inmate
	} else {
		console.log(din + ' not found');
		console.log(html)
	}
}

function* DIN(year,receptionCenterCode) {
	var din = year.toString().slice(-2) + receptionCenterCode;
	for (var i = 1; i < 9999; i++) {
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


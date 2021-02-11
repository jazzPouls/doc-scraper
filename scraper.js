let cheerio = require('cheerio');
let jsonframe = require('jsonframe-cheerio');
const axios = require('axios');
const { Parser,transforms: { flatten }, } = require('json2csv');
var fs = require('fs');
var csvWriter = require('csv-write-stream')


const fields = ['ID', 'SENTENCE.minSentence'];
const opts = {
	fields: fields
	// transforms: flatten({ objects: false, arrays: true });
};


var url = 'http://nysdoccslookup.doccs.ny.gov/GCA00P00/WIQ2/WINQ120';


var inmateform = {
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
}

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
}





const myClient = axios.create({
  baseURL: url,
  headers: {
    Connection: 'keep-alive'
  }
})

async function getDIN(DIN) {
  try {
  	console.log(DIN);
  	const data = {
		M12_SEL_DINI: DIN,
    	K01: 'WINQ120'
	};
    let res = await myClient.post('', new URLSearchParams(data));
    console.log(DIN + " returned ")
    parseHTML(res.data)
  } catch (err) {
    console.error(DIN + " " + err);
  }
};

const outcsv = fs.createWriteStream('out.csv');

for (let i = 1005; i < 1010; i++) {
	getDIN('18A'+i)
}

var parseHTML = function(html) {
	console.log('parsing')
	console.log(html)
	let $ = cheerio.load(html);
	jsonframe($); // initializes the plugin

	var inmate = $('#content').scrape(inmateformSentence)
	console.log(inmate)
	
	outcsv.write(flattenCSV(inmate))
}

var flattenCSV = function(data) {
    var result = "";
    function recurse (cur, prop) {
        if (Object(cur) !== cur) {
            result += cur + ",";
        } else if (Array.isArray(cur)) {
             for(var i=0, l=cur.length; i<l; i++)
                 recurse(cur[i], prop + "[" + i + "]");
            if (l == 0)
                result+= '[],';
        } else {
            var isEmpty = true;
            for (var p in cur) {
                isEmpty = false;
                recurse(cur[p], prop ? prop+"."+p : p);
            }
            if (isEmpty && prop)
                result+=",";
        }
    }
    recurse(data, "");
    // console.log("flattened "+result)
    // result = result.slice(0, -1)
    result += '\n'
    return result;
}


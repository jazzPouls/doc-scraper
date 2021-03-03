# doc-scraper
 
Scrapes NYDOC [inmate lookup](http://nysdoccslookup.doccs.ny.gov/) and saves all available records to csv  
Iterates over all valid Department Identification Numbers (DIN), posting request to DOC server and parsing html response

Current version scrapes ~300,000 records from years 2000-2020

Written in NodeJS, batching 100 axios requests at a time. Parsing uses cheerio + jsonframe-cheerio

import { client } from 'yelp-fusion';
import 'dotenv/config';
import fs from 'fs';
import { getConfidenceInterval, getWeightedRating } from './stats.js';

let location;

// Help text
// eslint-disable-next-line no-undef
if (!process.argv[2] || process.argv[2].includes('help'))
  console.log(
    'Call this program with an argument to be passed into the location parameter in the Yelp API (i.e. Los Angeles, CA). The program will not regenerate fresh results be default. Delete the out.json file to regenerate new results. API_KEY needs to be in a `.env` file. Set star rating thresholds and scrutiny level in index.js'
  );
else {
  // eslint-disable-next-line no-undef
  location = process.argv[2];
}

// eslint-disable-next-line no-undef
const api = client(process.env.API_KEY);

const timestamp = new Date().toISOString().replace(/[:T-]/g, '-').slice(0, -5);

async function callApi(page = 1) {
  if (page !== 1) console.log('Running new API request');
  if (page < 1) throw new Error(`Page number must be at least 1: ${page}`);

  const { jsonBody } = await api.search({
    term: 'affordable vet',
    location,
    radius: 40000,
    categories: ['vet'],
    limit: 50,
    offset: (page - 1) * 50,
  });

  if (!jsonBody.businesses)
    throw new Error('Request failed to return businesses!');

  fs.writeFileSync(
    `archive/${timestamp}-page-${page}.json`,
    JSON.stringify(jsonBody, null, 2)
  );
  return jsonBody;
}

async function search() {
  console.log('Running new API search');
  const data = await callApi();

  console.log(`${data.businesses.length}/${data.total}`);

  for (let page = 2; data.total > data.businesses.length; page++) {
    data['businesses'] = data.businesses.concat(
      (await callApi(page)).businesses
    );
    console.log(`${data.businesses.length}/${data.total}`);
  }

  fs.writeFileSync(
    `archive/${timestamp}-final.json`,
    JSON.stringify(data, null, 2)
  );
  fs.writeFileSync('out.json', JSON.stringify(data, null, 2));

  return data;
}

function validate(data) {
  // Check that all results have been requested from Yelp
  if (data.total !== data.businesses.length)
    throw new Error(
      `Mismatch in result length from Yelp API: ${data.total}!=${data.businesses.length}`
    );

  // Check that there are no duplicate ids in the businesses array
  const idSet = new Set();
  for (const business of data.businesses) {
    if (idSet.has(business.id))
      throw new Error(`Duplicate ID found: ${business.id}`);
    idSet.add(business.id);
  }
}

// eslint-disable-next-line no-unused-vars
function testStats(data) {
  const confidenceLevel = 0.95;

  for (const { id, rating, review_count } of data.businesses) {
    console.log(id, rating, review_count);
    const [lowerBound, upperBound] = getConfidenceInterval(
      rating / 5,
      review_count,
      confidenceLevel
    );
    const weightedRating = getWeightedRating(
      rating / 5,
      review_count,
      confidenceLevel
    );
    console.log(
      (lowerBound * 5).toFixed(3),
      (upperBound * 5).toFixed(3),
      (weightedRating * 5).toFixed(3)
    );
  }
}

function getVets(businesses, cutoff, confidenceLevel) {
  const passedVets = [];
  const failedVets = [];

  for (const business of businesses) {
    if (!business.weightedRating)
      business.weightedRating =
        getWeightedRating(
          business.rating / 5,
          business.review_count,
          confidenceLevel
        ) * 5;
    if (business.weightedRating >= cutoff) passedVets.push(business);
    else failedVets.push(business);
  }

  // Sort by weightedRating
  passedVets.sort((a, b) => b.weightedRating - a.weightedRating);

  // Summarize URLs at end of array
  passedVets.push(
    passedVets.reduce((accum, { id, rating, weightedRating, url }) => {
      accum[id] = { rating, weightedRating, url };
      return accum;
    }, {})
  );

  return [passedVets, failedVets];
}

async function main() {
  let data;

  if (!fs.existsSync('out.json')) data = await search();
  else data = JSON.parse(fs.readFileSync('out.json'));

  validate(data);

  console.log(`Number of results: ${data.total}`);

  // testStats(data);

  // Set star rating thresholds here, 0-5 star. 5 star is the better rating.
  const filters = [4.8, 4.5, 4.3, 4];

  const failedVets = filters.reduce((accum, filter) => {
    // Set confidence level here for scrutiny. 0-1. 1 is higher scrutiny.
    const [passedVets, failedVets] = getVets(accum, filter, 0.95);

    console.log(`Vets that passed ${filter}* filter: ${passedVets.length}`);
    console.log(`Remaining: ${failedVets.length}`);

    fs.writeFileSync(
      `archive/filter/${timestamp}-${filter} rating.json`,
      JSON.stringify(passedVets, null, 2)
    );
    fs.writeFileSync(
      `${filter} rating.json`,
      JSON.stringify(passedVets, null, 2)
    );

    return failedVets;
  }, data.businesses);

  console.log(`Vets that did not meet filters: ${failedVets.length}`);

  fs.writeFileSync('Failed ratings.json', JSON.stringify(data, null, 2));
}

main();

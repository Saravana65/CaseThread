const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Parser = require('../knowledge-base/intelligence/query-understanding/queryParser');
const Extractor = require('../knowledge-base/extractors/jsonExtractor');
const Ranker = require('../knowledge-base/intelligence/ranking/caseRanker');
const Comparator = require('../knowledge-base/intelligence/case-comparison/caseComparator');
const Reasoner = require('../knowledge-base/intelligence/reasoning/evidenceReasoner');

test('spoken graphics card theft retrieves a property match without inventing its resolution', async () => {
  const criteria = Parser.parse('Tell us about a robbery at a house at 9pm. Money was not stolen from the house. Only graphics cards were stolen.');
  assert.deepEqual(criteria.propertyKeywords, ['graphics cards']);
  assert.deepEqual(criteria.ignoredItems, ['cash']);
  assert.equal(criteria.approximateTime.hour24, 21);
  assert.equal(criteria.premises, 'RESIDENTIAL');
  assert.deepEqual(criteria.targetCountries, []);
  assert.equal(criteria.requestedIntent, 'SIMILAR_CASES');

  const file = path.join(__dirname, '../knowledge-base/public-case-archive/garage-graphics-cards.json');
  const { metadata } = await Extractor.extract(file);
  const cases = Ranker.rank([{
    ...metadata, document_id: 1, document_title: metadata.title,
    case_reference_number: metadata.case_number, case_outcome: metadata.verdict,
    source_name: metadata.publisher
  }], criteria);
  assert.ok(cases[0].match_breakdown.some(match => match.attribute === 'STOLEN_PROPERTY'));
  const result = Reasoner.reason({
    criteria, rankedCases: cases, comparisons: cases.map(c => Comparator.compare(criteria, c)), citations: []
  });
  assert.match(result.answer, /DRN-3884224/);
  assert.match(result.answer, /do not explain/);
  assert.match(result.answer, /serial numbers/);
});

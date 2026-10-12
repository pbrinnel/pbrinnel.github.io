// The lists of script files agree: life.html loads every file in js/ (terrain-worker.js runs
// as a Worker instead), every one with the same ?v=, and the sim's files that the harness and
// the lab's worker load are the page's, in the page's order. A file split or added in one list
// and not the others fails here, not in a half-loaded page.
'use strict';
const fs = require('fs'), path = require('path');
const { SIM_FILES } = require('./harness.js');
const { ok, done } = require('./kit.js').tally();

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, '..', 'life.html'), 'utf8');
const page = [...html.matchAll(/<script src="Life\/js\/([\w-]+)\.js\?v=(\d+)"><\/script>/g)];
const pageFiles = page.map(m => m[1]);
const NOT_IN_PAGE = ['terrain-worker'];

const versions = new Set(page.map(m => m[2]));
const asV = (html.match(/AS = \{ V: (\d+)/) || [])[1];
ok(versions.size === 1 && versions.has(asV), `every script's ?v= and AS.V agree (${[...versions].join(', ')}; AS.V ${asV})`);
const css = (html.match(/style\.css\?v=(\d+)/) || [])[1];
ok(css === asV, `the stylesheet's ?v= matches too (${css})`);

const onDisk = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => f.slice(0, -3));
const unloaded = onDisk.filter(f => !pageFiles.includes(f) && !NOT_IN_PAGE.includes(f));
ok(unloaded.length === 0, `life.html loads every js/ file${unloaded.length ? ': missing ' + unloaded.join(', ') : ''}`);

const inOrder = list => list.every((f, i) => i === 0 || pageFiles.indexOf(list[i - 1]) < pageFiles.indexOf(f));
const missing = SIM_FILES.filter(f => !pageFiles.includes(f));
ok(!missing.length && inOrder(SIM_FILES), `harness SIM_FILES are page files in page order${missing.length ? ': not in page ' + missing.join(', ') : ''}`);

const lab = fs.readFileSync(path.join(ROOT, '_lab', 'worker.js'), 'utf8').match(/SIM_FILES = \[([^\]]*)\]/);
const labFiles = lab ? [...lab[1].matchAll(/'([\w-]+)'/g)].map(m => m[1]) : [];
ok(labFiles.join() === SIM_FILES.join(), `the lab's worker loads the harness's sim files (${labFiles.length} of ${SIM_FILES.length})`);

done('files agree');

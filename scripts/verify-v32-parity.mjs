// Historical migration proof, not a restriction on future feature releases.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {buildHtml} from './build.mjs';
const expected='02b156120a177e3979b6696e4511a61240ad9e000ba685f77d109fb3d78c6486';
const html=await buildHtml();
assert.equal((html.match(/V3\.3/g)||[]).length,3,'Version in title, badge and dynamic browser title');
assert.equal((html.match(/\/\/ Version 3\.3/g)||[]).length,1,'Version in source comment');
const restored=html.replaceAll('V3.3','V3.2').replace('// Version 3.3','// Version 3.2');
const actual=crypto.createHash('sha256').update(restored).digest('hex');
assert.equal(actual,expected,'V3.2 parity: any difference beyond the four version label occurrences is a failure.');
console.log('PASS: Abgesehen von vier Versionsangaben ist der komplette V3.3-Build bytegenau identisch mit der bestätigten GitHub-V3.2.');

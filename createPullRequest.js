/* HARDCODED CONFIG */
var owner = "gczetterptc";
var repo = "Gabor_branching_POC";
var baseBranch = "main";
var token = "in_codebeamer"

// JUST DMEO
var CUSTOM_FIELDS = {
    repository: 1.0,
    repositoryUrl: 6.0,
    branchName: 3.0,
    branchUrl: 7.0
};

// GETTING TOKEN FROM CONFIG WORKITEM
var tokenItemId = 1025407; // replace with your token item ID
var trackerItemManager = applicationContext.getBean("trackerItemManager");
var tokenItem = trackerItemManager.findById(new java.lang.Integer(tokenItemId));
if (tokenItem == null) {
    throw "Token item not found: " + tokenItemId;
}
token = tokenItem.getDescription();
// ===================== //

/*
 * Codebeamer custom workflow action
 * Create GitHub Pull Request from current work item
 *
 * Expected custom fields:
 *  - Repository field: owner/repo OR https://github.com/owner/repo.git
 *  - Branch field: feature/cb-123456-my-feature
 *  - PR URL field: field where the created PR URL will be written
 *
 * IMPORTANT:
 *  - Do not throw or log the token.
 *  - Make sure the branch already exists on GitHub before running this.
 */

/* =========================
   CONFIGURATION
   ========================= */

// Codebeamer item ID where the GitHub token is stored in Description
var TOKEN_ITEM_ID = 123456; // CHANGE THIS

// Current item custom field indexes
var PR_URL_CF = 9.0;    // CHANGE THIS: PR URL output field

// Pull request target branch
var BASE_BRANCH = "main";

// GitHub API base
var GITHUB_API_BASE = "https://api.github.com";


/* =========================
   HELPERS
   ========================= */

function fail(message) {
    throw "Create PR failed: " + message;
}

function valueToString(value) {
    if (value == null) {
        return "";
    }
    return ("" + value).trim();
}

function stripHtml(value) {
    return valueToString(value).replace(/<[^>]*>/g, "").trim();
}

function jsonEscape(value) {
    return valueToString(value)
        .replace(/\\/g, "\\\\")
        .replace(/"/g, "\\\"")
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t");
}

function slugify(value) {
    return valueToString(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+/, "")
        .replace(/-+$/, "");
}

function readAll(stream) {
    var reader = new java.io.BufferedReader(
        new java.io.InputStreamReader(stream, "UTF-8")
    );

    var sb = new java.lang.StringBuilder();
    var line;

    while ((line = reader.readLine()) != null) {
        sb.append(line);
        sb.append("\n");
    }

    reader.close();
    return "" + sb.toString();
}

function extractToken(description) {
    var text = stripHtml(description);

    // Accept either:
    //   github_token=xxxxx
    //   token: xxxxx
    //   or the entire description is the token
    var match = text.match(/(?:github_token|token)\s*[:=]\s*([A-Za-z0-9_]+)/i);

    if (match != null) {
        return match[1];
    }

    // If description only contains the token
    if (text.indexOf("ghp_") == 0 || text.indexOf("github_pat_") == 0) {
        return text;
    }

    fail("GitHub token not found in token item description");
}

function parseRepository(repositoryValue) {

    var text = "" + repositoryValue;

    // Remove HTML tags if present
    text = text.replace(/<[^>]+>/g, "");

    // Extract GitHub URL
    var match = text.match(/https:\/\/github\.com\/([^\/\]]+)\/([^\/\]\s]+)/i);

    if (match != null) {
        return {
            owner: match[1],
            repo: match[2].replace(/\.git$/, "")
        };
    }

    // Fallback: owner/repo format
    text = text
        .replace(/^\[/, "")
        .replace(/\]$/, "")
        .trim();

    match = text.match(/^([^\/\s]+)\/([^\/\s]+)$/);

    if (match != null) {
        return {
            owner: match[1],
            repo: match[2]
        };
    }

    throw "Cannot parse repository value: " + text;
}

function getSubjectLink() {
    try {
        return "" + subject.getUrlLink();
    } catch (e1) {
        try {
            return "" + subject.getInterwikiLink();
        } catch (e2) {
            return "Codebeamer item ID: " + subject.getId();
        }
    }
}

function getSubjectKey() {
    try {
        return "" + subject.getKeyAndId();
    } catch (e1) {
        return "CB-" + subject.getId();
    }
}


/* =========================
   READ CURRENT ITEM VALUES
   ========================= */

var repositoryValue = subject.getCustomField(CUSTOM_FIELDS.repositoryUrl);
var branchValue = subject.getCustomField(CUSTOM_FIELDS.branchName);

var repository = parseRepository(repositoryValue);

var headBranch = valueToString(branchValue);

if (headBranch == "") {
    fail("Branch field is empty. Create/push the branch before creating a PR.");
}

var itemId = subject.getId();
var itemKey = getSubjectKey();
var itemName = valueToString(subject.getName());

if (itemName == "") {
    itemName = "Codebeamer item " + itemId;
}

var prTitle = "#" + itemId + ": " + itemName;

var prBody =
    "Created from Codebeamer workflow action\\n\\n" +
    "Codebeamer item: " + itemKey + "\\n" +
    "Item ID: " + itemId + "\\n" +
    "Branch: " + headBranch + "\\n" +
    "Target branch: " + BASE_BRANCH + "\\n\\n" +
    getSubjectLink();


/* =========================
   CREATE GITHUB PR
   ========================= */

var apiUrl =
    GITHUB_API_BASE +
    "/repos/" +
    repository.owner +
    "/" +
    repository.repo +
    "/pulls";

var payload =
    "{" +
    "\"title\":\"" + jsonEscape(prTitle) + "\"," +
    "\"head\":\"" + jsonEscape(headBranch) + "\"," +
    "\"base\":\"" + jsonEscape(BASE_BRANCH) + "\"," +
    "\"body\":\"" + jsonEscape(prBody) + "\"" +
    "}";

var url = new java.net.URL(apiUrl);
var conn = url.openConnection();

conn.setRequestMethod("POST");
conn.setDoOutput(true);
conn.setConnectTimeout(30000);
conn.setReadTimeout(30000);

conn.setRequestProperty("Accept", "application/vnd.github+json");
conn.setRequestProperty("Content-Type", "application/json");
conn.setRequestProperty("Authorization", "Bearer " + token);
conn.setRequestProperty("X-GitHub-Api-Version", "2022-11-28");
conn.setRequestProperty("User-Agent", "codebeamer-workflow-action");

var writer = new java.io.OutputStreamWriter(conn.getOutputStream(), "UTF-8");
writer.write(payload);
writer.flush();
writer.close();

var status = conn.getResponseCode();

var responseStream;
if (status >= 200 && status < 300) {
    responseStream = conn.getInputStream();
} else {
    responseStream = conn.getErrorStream();
}

var response = "";
if (responseStream != null) {
    response = readAll(responseStream);
}


/* =========================
   HANDLE RESPONSE
   ========================= */

if (status < 200 || status >= 300) {
    // Do not include token in error. Response is GitHub API response only.
    fail("GitHub API returned HTTP " + status + ": " + response);
}

var htmlUrlMatch = response.match(/"html_url"\s*:\s*"([^"]+)"/);

if (htmlUrlMatch == null) {
    fail("PR created, but html_url was not found in GitHub response");
}

var prUrl = htmlUrlMatch[1];

// Store PR URL back to Codebeamer
subject.setCustomField(PR_URL_CF, "[" + prUrl + "]");

// Safe final message
throw "Pull Request created: " + prUrl;
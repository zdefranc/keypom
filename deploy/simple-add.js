const { connect, KeyPair, keyStores, utils } = require("near-api-js");
const { parseNearAmount, formatNearAmount } = require("near-api-js/lib/utils/format");
const path = require("path");
const homedir = require("os").homedir();
const { writeFile, mkdir, readFile } = require('fs/promises');
  
let LINKDROP_PROXY_CONTRACT_ID = process.env.LINKDROP_PROXY_CONTRACT_ID;
let FUNDING_ACCOUNT_ID = process.env.FUNDING_ACCOUNT_ID;
let LINKDROP_NEAR_AMOUNT = process.env.LINKDROP_NEAR_AMOUNT;

let OFFSET = 0.1;
let KEY_FEE = 0.005;
let NUM_KEYS = 3;

let NETWORK_ID = "testnet";
let near;
let config;
let keyStore;

// set up near
const initiateNear = async () => {
	const CREDENTIALS_DIR = ".near-credentials";

	const credentialsPath = (await path).join(homedir, CREDENTIALS_DIR);
	(await path).join;
	keyStore = new keyStores.UnencryptedFileSystemKeyStore(credentialsPath);

	config = {
		networkId: NETWORK_ID,
		keyStore,
		nodeUrl: "https://rpc.testnet.near.org",
		walletUrl: "https://wallet.testnet.near.org",
		helperUrl: "https://helper.testnet.near.org",
		explorerUrl: "https://explorer.testnet.near.org",
	};

	near = await connect(config);
};

async function start() {
	//deployed linkdrop proxy contract
	await initiateNear();

	if(!LINKDROP_PROXY_CONTRACT_ID || !FUNDING_ACCOUNT_ID || !LINKDROP_NEAR_AMOUNT) {
		throw "must specify proxy contract ID, funding account ID, linkdrop $NEAR amount and whether to send multiple";
	}

	const fundingAccount = await near.account(FUNDING_ACCOUNT_ID);

	let keyPairs = [];
	let pubKeys = [];

	console.log("BATCH Creating keypairs");
	for(var i = 0; i < NUM_KEYS; i++) {
		console.log('i: ', i);
		let keyPair = await KeyPair.fromRandom('ed25519'); 
		keyPairs.push(keyPair);   
		pubKeys.push(keyPair.publicKey.toString());   
	}
	console.log("Finished.");

	let dropId = await fundingAccount.viewFunction(
		LINKDROP_PROXY_CONTRACT_ID, 
		'get_nonce',
	);

	dropId -= 1;
	
	console.log('dropId: ', dropId);

	try {
		await fundingAccount.functionCall(
			LINKDROP_PROXY_CONTRACT_ID, 
			'add_to_balance', 
			{},
			"300000000000000", 
			parseNearAmount(
				((parseFloat(LINKDROP_NEAR_AMOUNT) + KEY_FEE + OFFSET) * pubKeys.length).toString()
			)
		);
	} catch(e) {
		console.log('error initializing contract: ', e);
	}

	try {
		await fundingAccount.functionCall(
			LINKDROP_PROXY_CONTRACT_ID, 
			'add_to_drop', 
			{
				public_keys: pubKeys,
				drop_id: dropId
			}, 
			"300000000000000", 
		);
	} catch(e) {
		console.log('error initializing contract: ', e);
	}

	try {
		let viewData = {};
		const totalSupply = await fundingAccount.viewFunction(
			LINKDROP_PROXY_CONTRACT_ID, 
			'key_total_supply', 
		);
		viewData.key_total_supply = totalSupply; 
		console.log('totalSupply: ', totalSupply);

		const getKeys = await fundingAccount.viewFunction(
			LINKDROP_PROXY_CONTRACT_ID, 
			'get_keys'
		);
		viewData.get_keys = getKeys; 
		console.log('getKeys: ', getKeys);

		const keyInfo = await fundingAccount.viewFunction(
			LINKDROP_PROXY_CONTRACT_ID, 
			'get_key_information',
			{
				key: pubKeys[0]
			}
		);
		viewData.get_key_information = keyInfo; 
		console.log('keyInfo: ', keyInfo);

		const dropInfo = await fundingAccount.viewFunction(
			LINKDROP_PROXY_CONTRACT_ID, 
			'get_drop_information',
			{
				drop_id: dropId
			}
		);
		viewData.get_drop_information = dropInfo; 
		console.log('dropInfo: ', dropInfo);

		const keysForDrop = await fundingAccount.viewFunction(
			LINKDROP_PROXY_CONTRACT_ID, 
			'get_keys_for_drop',
			{
				drop_id: dropId
			}
		);
		viewData.get_keys_for_drop = keysForDrop; 
		console.log('keysForDrop: ', keysForDrop);


		const keySupplyForFunder = await fundingAccount.viewFunction(
			LINKDROP_PROXY_CONTRACT_ID, 
			'key_supply_for_funder',
			{
				account_id: FUNDING_ACCOUNT_ID
			}
		);
		viewData.key_supply_for_funder = keySupplyForFunder; 
		console.log('keySupplyForFunder: ', keySupplyForFunder);

		const dropSupplyForFunder = await fundingAccount.viewFunction(
			LINKDROP_PROXY_CONTRACT_ID, 
			'drop_supply_for_funder',
			{
				account_id: FUNDING_ACCOUNT_ID
			}
		);
		viewData.drop_supply_for_funder = dropSupplyForFunder; 
		console.log('dropSupplyForFunder: ', dropSupplyForFunder);

		const dropsForFunder = await fundingAccount.viewFunction(
			LINKDROP_PROXY_CONTRACT_ID, 
			'drops_for_funder',
			{
				account_id: FUNDING_ACCOUNT_ID
			}
		);
		viewData.drops_for_funder = dropsForFunder; 
		console.log('dropsForFunder: ', dropsForFunder);

		await writeFile(`./views-add.json`, JSON.stringify(viewData));
	} catch(e) {
		console.log('error initializing contract: ', e);
	}


    
	for(var i = 0; i < keyPairs.length; i++) {
		console.log(`https://wallet.testnet.near.org/linkdrop/${LINKDROP_PROXY_CONTRACT_ID}/${keyPairs[i].secretKey}`);
		console.log("Pub Key: ", keyPairs[i].publicKey.toString());
	}
}


start();
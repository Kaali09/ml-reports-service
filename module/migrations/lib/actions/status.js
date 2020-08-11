const { find } = require("lodash");
const migrationsDir = require("../env/migrationsDir");
let config = require('../../../../config/config');

module.exports = async db => {
  await migrationsDir.shouldExist();
  
  let fileValue
  const fileNames = await migrationsDir.getFileNames();

  if(alias== "u" && (upgradeOneItem && fileNames.includes(upgradeOneItem))){
    fileValue = [upgradeOneItem]
  }else if(alias == "d" && (downgradeOneItem && fileNames.includes(downgradeOneItem))){
    fileValue = [downgradeOneItem]
  }else{
    fileValue = fileNames
  }
  const collectionName = config.mongodb.migration_collection || "migrations"

  const collection = db.collection(collectionName);
  const changelog = await collection.find({}).toArray();

  const statusTable = fileValue.map(fileName => {
    const itemInLog = find(changelog, { fileName });
    const appliedAt = itemInLog ? itemInLog.appliedAt.toJSON() : "PENDING";
    return { fileName, appliedAt };
  });

  return statusTable;
};

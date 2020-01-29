var config = require('../../config/config');
var rp = require('request-promise');
var request = require('request');
var model = require('../../db')
var helperFunc = require('../../helper/chart_data');
var commonCassandraFunc = require('../../common/cassandra_func');
var pdfHandler = require('../../helper/common_handler');


//Controller for entity assessment report
exports.entityAssessment = async function (req, res) {
  return new Promise(async function (resolve, reject) {
      let data = await assessmentReportGetChartData(req, res);
      res.send(data);
  })
}

async function assessmentReportGetChartData(req, res) {
  return new Promise(async function (resolve, reject) {

  if (!req.body.entityId || !req.body.entityType || !req.body.programId || !req.body.solutionId) {
    res.status(400);
    var response = {
      result: false,
      message: 'entityId,entityType,programId,solutionId and immediateChildEntityType are required fields'
    }
    resolve(response);
  }
  else {

    childType = req.body.immediateChildEntityType;
    reqBody = req.body
    //var dataAssessIndexes = await commonCassandraFunc.checkAssessmentReqInCassandra(reqBody)
    // if (dataAssessIndexes == undefined) {
      //get domainName and level info
      model.MyModel.findOneAsync({ qid: "entity_assessment_query" }, { allow_filtering: true })
        .then(async function (result) {
          var bodyParam = JSON.parse(result.query);
          if(config.druid.assessment_datasource_name){
            bodyParam.dataSource = config.druid.assessment_datasource_name;
          }
          //dynamically appending values to filter
          bodyParam.filter.fields[0].dimension = req.body.entityType;
          bodyParam.filter.fields[0].value = req.body.entityId;
          bodyParam.filter.fields[1].value = req.body.programId;
          bodyParam.filter.fields[2].value = req.body.solutionId;
         
          if(req.body.immediateChildEntityType == ""){
            // req.body.immediateChildEntityType = "domain"
            bodyParam.dimensions.push("domainName","level","schoolName","school","programName");
            bodyParam.aggregations[0].fieldName = "domainName";
            bodyParam.aggregations[0].fieldNames.push("domainName");
            bodyParam.aggregations[0].name = "domainNameCount";
          }
          else{
            var entityName = req.body.immediateChildEntityType + "Name";
            bodyParam.dimensions.push(req.body.immediateChildEntityType,entityName,"level","programName");
            bodyParam.aggregations[0].fieldName = entityName;
            bodyParam.aggregations[0].fieldNames.push(entityName);
            bodyParam.aggregations[0].name = entityName + "Count";
          }
          //pass the query as body param and get the resul from druid
          let opt = config.druid.options;
          opt.method = "POST";
          opt.body = bodyParam;
          var data = await rp(opt);

          if (!data.length) {

          //==========Production hotfix code============================

          //dynamically appending values to filter
          bodyParam.filter.fields[0].dimension = "school";
          childType = "";

          //pass the query as body param and get the resul from druid
          let options = config.druid.options;
          options.method = "POST";
          options.body = bodyParam;
          var assessData = await rp(options);
            
            if (!assessData.length) {
            resolve({"result":false,"data": {} })
            }
            else {

              let inputObj = {
                data : assessData,
                entityName : "domainName",
                childEntity : "",
                levelCount : "domainNameCount",
                entityType : "school"
              }
               //call the function entityAssessmentChart to get the data for stacked bar chart 
              var responseObj = await helperFunc.entityAssessmentChart(inputObj);
                  responseObj.title = "Performance Report";
                 bodyParam.dimensions.push("childType","childName","domainExternalId");
                 if(!bodyParam.dimensions.includes("domainName")){
                   bodyParam.dimensions.push("domainName");
                 }
                 if(req.body.immediateChildEntityType == ""){
                   req.body.immediateChildEntityType = "school"
                 }
                 //pass the query as body param and get the result from druid
                 let optionsData = config.druid.options;
                 optionsData.method = "POST";
                 optionsData.body = bodyParam;
                 let entityData = await rp(optionsData);
                 let dataObject = {
                   entityData :entityData,
                   childEntityType : req.body.immediateChildEntityType,
                   entityType : "school"
                 }
                 //call the function to get the data for expansion view of domain and criteria
                 var tableObject = await helperFunc.entityTableViewFunc(dataObject)
                 tableObject.chart.title = "Descriptive View";
                 responseObj.reportSections.push(tableObject);
   
                 if(childType){
                 //call samiksha entity list assessment API to get the grandchildEntity type.
                 var grandChildEntityType = await assessmentEntityList(req.body.entityId,childType,req.headers["x-auth-token"])
                 if(grandChildEntityType.status == 200){
                   if(grandChildEntityType.result[0].subEntityGroups.length != 0){
                   responseObj.reportSections[0].chart.grandChildEntityType = grandChildEntityType.result[0].immediateSubEntityType;
                   resolve(responseObj);
                   }
                   else{
                     responseObj.reportSections[0].chart.grandChildEntityType = "";
                     resolve(responseObj);
                   }
                 }
                 else{
                 responseObj.reportSections[0].chart.grandChildEntityType = "";
                 resolve(responseObj);
                 }
               }
               else{
                 responseObj.reportSections[0].chart.grandChildEntityType = "";
                 resolve(responseObj);
               }
              // commonCassandraFunc.insertAssessmentReqAndResInCassandra(reqBody, responseObj)
             

            }


          }


         else {
           var inputObj = {
             data : data,
             entityName : bodyParam.aggregations[0].fieldName,
             childEntity : req.body.immediateChildEntityType,
             levelCount : bodyParam.aggregations[0].name,
             entityType : req.body.entityType
           }
            //call the function entityAssessmentChart to get the data for stacked bar chart 
           var responseObj = await helperFunc.entityAssessmentChart(inputObj);
              bodyParam.dimensions.push("childType","childName","domainExternalId");
              if(!bodyParam.dimensions.includes("domainName")){
                bodyParam.dimensions.push("domainName");
              }
              if(req.body.immediateChildEntityType == ""){
                req.body.immediateChildEntityType = "school"
              }
              //pass the query as body param and get the result from druid
              var options = config.druid.options;
              options.method = "POST";
              options.body = bodyParam;
              var entityData = await rp(options);
              var dataObj = {
                entityData :entityData,
                childEntityType : req.body.immediateChildEntityType,
                entityType : req.body.entityType
              }
              //call the function to get the data for expansion view of domain and criteria
              var tableObj = await helperFunc.entityTableViewFunc(dataObj)
              responseObj.reportSections.push(tableObj);

              if(childType){
              //call samiksha entity list assessment API to get the grandchildEntity type.
              var grandChildEntityType = await assessmentEntityList(req.body.entityId,childType,req.headers["x-auth-token"])
              if(grandChildEntityType.status == 200){
                if(grandChildEntityType.result[0].subEntityGroups.length != 0){
                responseObj.reportSections[0].chart.grandChildEntityType = grandChildEntityType.result[0].immediateSubEntityType;
                resolve(responseObj);
                }
                else{
                  responseObj.reportSections[0].chart.grandChildEntityType = "";
                  resolve(responseObj);
                }
              }
              else{
              responseObj.reportSections[0].chart.grandChildEntityType = "";
              resolve(responseObj);
              }
            }
            else{
              responseObj.reportSections[0].chart.grandChildEntityType = "";
              resolve(responseObj);
            }
          //  commonCassandraFunc.insertAssessmentReqAndResInCassandra(reqBody, responseObj)
          }
      })
        .catch(function (err) {
          res.status(400);
          var response = {
            result: false,
            message: 'Data not found'
          }
          resolve(response);
        })
    // } else {
    //   resolve(JSON.parse(dataAssessIndexes['apiresponse']))
    // }
  }
});
}



//function to make a call to samiksha assessment entities list API
async function assessmentEntityList(entityId,childType,token) {

  return new Promise(async function(resolve){
  var options = {
    method: "GET",
    json: true,
    headers: {
        "Content-Type": "application/json",
        "X-authenticated-user-token": token
    },
    uri: config.samiksha_api.assessment_entity_list_api + entityId + "?type=" + childType
}

  rp(options).then(function(resp){
    return resolve(resp);

  }).catch(function(err){
    return resolve(err);
  })

});
}


//Function to generate PDF for entity assessment API
exports.assessmentPdfReport = async function(req, res) {
  if (!req.body.entityId || !req.body.entityType || !req.body.programId || !req.body.solutionId) {
    res.status(400);
    var response = {
      result: false,
      message: 'entityId,entityType,programId,solutionId and immediateChildEntityType are required fields'
    }
    res.send(response);
  }
    else{
    reqData = req.body;
    //var dataReportIndexes = await commonCassandraFunc.checkAssessmentReqInCassandra(reqData);
   
    // if (dataReportIndexes && dataReportIndexes.downloadpdfpath) {

     
    //  dataReportIndexes.downloadpdfpath = dataReportIndexes.downloadpdfpath.replace(/^"(.*)"$/, '$1');
    //  let signedUlr = await pdfHandler.getSignedUrl(dataReportIndexes.downloadpdfpath);


      // var response = {
      //   status: "success",
      //   message: 'Assessment Pdf Generated successfully',
      //   pdfUrl: signedUlr
      // };
      // res.send(response);

    //  } else {
      // var assessmentRes;
      // if (dataReportIndexes) {
      //   assessmentRes = JSON.parse(dataReportIndexes['apiresponse']);
      // }
      // else {
        assessmentRes = await assessmentReportGetChartData(req, res);
      // }


      if(assessmentRes.result == true){
      
     // let resData = await pdfHandler.assessmentPdfGeneration(assessmentRes);
     let resData = await pdfHandler.assessmentPdfGeneration(assessmentRes, true);

      // if (dataReportIndexes) {
      //   var reqOptions = {
      //     query: dataReportIndexes.id,
      //     downloadPath:resData.downloadPath
      //   }
      //   commonCassandraFunc.updateEntityAssessmentDownloadPath(reqOptions);
      // } else {
      //   //store download url in cassandra
      //   let dataInsert = commonCassandraFunc.insertAssessmentReqAndResInCassandra(reqData, resData, resData.downloadPath);
      // }

        let hostname = req.headers.host;

        var responseObject = {
          "status": "success",
          "message": "report generated",
          pdfUrl: "https://" + hostname + "/dhiti/api/v1/observations/pdfReportsUrl?id=" + resData.pdfUrl
        }
       
        res.send(responseObject);
        // res.send(omit(resData,'downloadPath'));
      }
    else {
      res.send(assessmentRes);
    }
   
    // }
   }
};

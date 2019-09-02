const FileDao = require('../dao/file.dao.js');
const BaseUtil = require('../util/base.js');
const fileDao = new FileDao();
const BaseResJson = require('../util/baseResJson.js');

// 实例化
let baseUtil = new BaseUtil();
let resJson = new BaseResJson();

// 获取 root guid
const getRootId = async (req, res, next) => {
  try {
    let data = await fileDao.findOne({ fileType: 'root' }, {_id: 0})
    if(!data) {
      const rp = {
        parentid: '0',
        fileName: '',
        fileType: 'root',
        extName: '',
        userid: 'qingqingrootid'
      }
      data = await fileDao.create(rp)
    }
    resJson.emit({res, data})
  } catch (error) {
    console.log(error)
    resJson.emit({res, error_code: 2000})
  }
}

// 添加文件
const addFile = async (req, res, next) => {
  try {
    const { userid } = JSON.parse(req.cookies.user)
    const { parentid } = req.body
    const data = await fileDao.create({
      parentid,
      userid
    })
    resJson.emit({res, data})
  } catch (error) {
    console.log(error)
    resJson.emit({res, error_code: 2000})
  }
}

// 添加文件夹
const addDirectory = async (req, res, next) => {
  try {
    const { userid } = JSON.parse(req.cookies.user)
    let { parentid, fileName = '新建文件夹' } = req.body
    let rp = {
      parentid,
      userid,
      fileName,
      fileType: 'directory',
      extName: ''
    }
    await fileDao.create(rp)
    resJson.emit({res})
  } catch (error) {
    console.log(error)
    resJson.emit({res, error_code: 2000})
  }
}

// 重命名
const reName = async (req, res, next) => {
  try {
    const { id, fileName } = req.body
    if(!(id && fileName)) resJson.emit({res, error_code: 10001})
    await fileDao.updateOne({ id }, { fileName })
    resJson.emit({res})
  } catch (error) {
    console.log(error)
    resJson.emit({res, error_code: 2000})
  }
}

// 更新单个字段
const update = async (req, res, next) => {
  try {
    const rp = req.body
    if(!(baseUtil.isObject(rp) && Object.keys(rp).length > 0)) resJson.emit({res, error_code: 10001})
    const { id } = rp
    const modifyDoc = {...rp}
    await fileDao.updateOne({ id }, modifyDoc)
    resJson.emit({res})
  } catch (error) {
    console.log(error)
    resJson.emit({res, error_code: 2000})
  }
}

// 批量丢入回收站
const rm = async (req, res, next) => {
  try {
    const { ids } = req.body
    if(!(Array.isArray(ids) && ids.length > 0)) resJson.emit({res, error_code: 10001})
    const _ids = await findChildrenIds(ids)

    if(Array.isArray(_ids) && _ids.length > 0) {
      // 更新数据
      await fileDao.updateMany(
        {
          id: {
            $in: _ids
          }
        },
        {
          $set: {
            isDelete: true
          }
        }
      )
      resJson.emit({res})
    } else {
      resJson.emit({res, error_code: 2000})
    }
  } catch (error) {
    console.log(error)
    resJson.emit({res, error_code: 2000})
  }
}

// 查询文件
let queryFile = async(req, res, next) => {
  try {
    const { id } = req.body;
    if(!id) resJson.emit({res, error_code: 10001})
    const data = await fileDao.find({
      id
    }, { 
      _id: 0 
    })
    resJson.emit({res, data})
  } catch (error) {
    console.log(error)
    resJson.emit({res, error_code: 2000})
  }
}

// 查询文件夹
const queryDirectory = async(req, res, next) => {
  try {
    let { parentid } = req.body
    if(!parentid) resJson.emit({res, error_code: 10001})
    const rp = {
      parentid,
      isDelete: {
        $eq: false
      }
    }
    let data = await fileDao.find(rp, { _id: 0 })
    resJson.emit({res, data})
  } catch (error) {
    console.log(error)
    resJson.emit({res, error_code: 2000})
  }
  
}

// 本人回收站数据列表
const querySelfDirectotyForTrash = async (req, res ,next) => {
  try {
    const { userid } = JSON.parse(req.cookies.user)
    let data = []
    
    // 查询一级父节点数据
    const files = await fileDao.aggregate([
      { 
        $graphLookup: { 
          from: "files", 
          startWith: "$parentid", 
          connectFromField: "parentid", 
          connectToField: "id", 
          as: "parentFiles",
          maxDepth: 0
        } 
      },
      {
        $match: {
          isDelete: true,
          userid
        }
      }
    ])

    // 直接父节点数据的isDelete值为false，则push
    if(Array.isArray(files) && files.length > 0) {
      for(let file of files) {
        const PFiles = file.parentFiles
        if(PFiles.length > 0 && !PFiles[0].isDelete) {
          let _file = {...file}
          delete _file.parentFiles
          data.push(_file)
        }
      }
    }

    resJson.emit({res, data})
  } catch (error) {
    console.log(error)
    resJson.emit({res, error_code: 2000})
  }
}

// 批量还原
const revertFiles = async (req, res, next) => {
  try {
    const { ids } = req.body
    if(!(Array.isArray(ids) && ids.length > 0)) resJson.emit({res, error_code: 10001})
    const _ids = await findChildrenIds(ids)
    
    if(Array.isArray(_ids) && _ids.length > 0) {
      // 更新数据
      await fileDao.updateMany(
        {
          id: {
            $in: _ids
          }
        },
        {
          $set: {
            isDelete: false
          }
        }
      )
      resJson.emit({res})
    } else {
      resJson.emit({res, error_code: 2000})
    }
  } catch (error) {
    console.log(error)
    resJson.emit({res, error_code: 2000})
  }
}

// 批量永久删除
const deleteFiles = async (req, res, next) => {
  try {
    const { ids } = req.body
    if(!(Array.isArray(ids) && ids.length > 0)) resJson.emit({res, error_code: 10001})
    const _ids = await findChildrenIds(ids)
    
    if(Array.isArray(_ids) && _ids.length > 0) {
      // 更新数据
      await fileDao.remove(
        {
          id: {
            $in: _ids
          }
        }
      )
      resJson.emit({res})
    } else {
      resJson.emit({res, error_code: 2000})
    }
  } catch (error) {
    console.log(error)
    resJson.emit({res, error_code: 2000})
  }
}

// 查询所有的子节点（包含自身）的id集合
const findChildrenIds = async (ids) => {
  let newids = [];
  // 查询所有的(包含自身)的子节点数据
  const files = await fileDao.aggregate([
    { 
      $graphLookup: { 
        from: "files", 
        startWith: "$id", 
        connectFromField: "id", 
        connectToField: "parentid", 
        as: "subFiles",
      } 
    },
    {
      $match: {
        id: {
          $in: ids
        }
      }
    }
  ])

  if(Array.isArray(files) && files.length > 0) {
    // 遍历出所有的id
    for(let file of files) {
      newids.push(file.id)
      if(file.subFiles.length > 0) {
        for(let subfile of file.subFiles) {
          newids.push(subfile.id)
        }
      }
    }
  }
  return newids
}

module.exports = {
  getRootId,
  addFile,
  reName,
  addDirectory,
  update,
  queryFile,
  queryDirectory,
  querySelfDirectotyForTrash,
  rm,
  revertFiles,
  deleteFiles
}
import { readDir} from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { resolve,basename,extname} from '@tauri-apps/api/path';
import { ElLoading} from 'element-plus';

interface imgType {
    httpsrc:string
    path:string,
    name:string,
    bool:boolean
}

//#region  选择文件 
export const openfile = async function() {
    let images:imgType[] = []
    const imgfiles = await open({
        "title":"选择文件",
        "multiple":true,
        "filters":[{"extensions":["png","jpg","jpeg","webp"],"name":"图片"}]
    })
    let load = ElLoading.service({
        "text":"加载图片中...",
    })
    if(!imgfiles) {
        load.close()
        return
    }
    for(let i = 0 ;i < imgfiles.length ; i++){
        const httpsrc = convertFileSrc(imgfiles[i].path)
        let name = await basename(imgfiles[i].path)
        images.push({
        httpsrc:httpsrc,
        path:imgfiles[i].path,
        name:name,
        bool:false
        })
    }
    load.close()
    return images;
}
//#endregion

//#region  选择文件夹并拿到文件列表
export const opendir = async function(){
    let images:imgType[] = []
    let dir = await open({
      "title":"选择文件夹",
      "directory":true,
      "recursive":true,
    })
    let load = ElLoading.service({
      "text":"加载图片中..."
    })
    if(!dir){
      load.close()
      return
    }
    const imgfiles = await readDir(dir)
    if(!imgfiles.length){
      load.close()
      return
    }
    let arr = []
    for(let i = 0;i<imgfiles.length;i++){
      if(imgfiles[i].isDirectory){
        imgfiles.splice(i,1)
        continue;
      }
      
      let ext = await extname(imgfiles[i].name)
      if(!ext){
        imgfiles.splice(i,1)
        continue
      }
      let extarr = ["jpg","jpeg","png","webp"];
      if(extarr.indexOf(ext.toLocaleLowerCase())<0){
        imgfiles.splice(i,1)
        continue;
      }
      arr.push(imgfiles[i])
    }
    imgfiles.length = 0
    imgfiles.push(...arr)

    for(let i = 0 ;i<imgfiles.length; i++){
      const path = await resolve(dir,imgfiles[i].name)
      const httpsrc = convertFileSrc(path)
      let name = await basename(path)
      images.push({
        httpsrc:httpsrc,
        path:path,
        name:name,
        bool:false
      })
    }
    load.close()
    return images;
  }
  //#endregion


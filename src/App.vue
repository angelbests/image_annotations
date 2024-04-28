<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { open } from '@tauri-apps/plugin-dialog';
import { readDir,create,exists,mkdir, readTextFile} from '@tauri-apps/plugin-fs';
import { resolve,basename,extname, resourceDir} from '@tauri-apps/api/path';
import { convertFileSrc,invoke } from '@tauri-apps/api/core';
import { ElLoading, ElMessage } from 'element-plus';
import { storeToRefs } from "pinia"
import { containersStore } from './store';
import hotkeys from 'hotkeys-js';
import { isArray } from 'element-plus/es/utils/types.mjs';
import { getCurrent } from '@tauri-apps/api/webviewWindow';
// 页面参数
const asideWidth = ref(200)
const imgref = ref<HTMLImageElement>()
const mainref = ref()
const input = ref("")
const appWindow =getCurrent()
// store 参数
const c = containersStore()
const { images,image,dirpath,imageIndex,imagessearch }  = storeToRefs(c)

//#region  选择文件 
const openfile = async function() {
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
  images.value.length = 0
  imagessearch.value.length = 0
  for(let i = 0 ;i < imgfiles.length ; i++){
    const httpsrc = convertFileSrc(imgfiles[i].path)
    let name = await basename(imgfiles[i].path)
    images.value.push({
      httpsrc:httpsrc,
      path:imgfiles[i].path,
      name:name,
      bool:false
    })
    imagessearch.value.push({
      httpsrc:httpsrc,
      path:imgfiles[i].path,
      name:name,
      bool:false
    })
  }
  image.value  = images.value[0].httpsrc
  let filename = await basename(images.value[0].path);
  dirpath.value = images.value[0].path.substring(images.value[0].path.indexOf(filename)-1,-1)
  imageIndex.value = 0
  load.close()
  appWindow.setTitle("数据标注工具 图片名称："+images.value[imageIndex.value].name+" 总数：" +imagessearch.value.length+" 序号："+(imageIndex.value+1))
}

//#endregion

//#region  选择文件夹并拿到文件列表
const opendir = async function() {
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
  dirpath.value = dir
  const imgfiles = await readDir(dirpath.value)
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
  images.value.length = 0
  imagessearch.value.length = 0
  for(let i = 0 ;i<imgfiles.length; i++){
    const path = await resolve(dirpath.value,imgfiles[i].name)
    const httpsrc = convertFileSrc(path)
    let name = await basename(path)
    images.value.push({
      httpsrc:httpsrc,
      path:path,
      name:name,
      bool:false
    })
    imagessearch.value.push({
      httpsrc:httpsrc,
      path:path,
      name:name,
      bool:false
    })
  }
  image.value  = images.value[0].httpsrc
  imageIndex.value = 0
  load.close()

  appWindow.setTitle("数据标注工具 图片名称："+images.value[imageIndex.value].name+" 总数：" +imagessearch.value.length+" 序号："+(imageIndex.value+1))
}

//#endregion

// 图片真实宽高
const imageWidth = ref(0)
const imageHeight = ref(0)

// img 的宽和高
const imgWidth = ref(0)
const imgHeight = ref(0)

// 实际缩放比例
const rateWidth = computed(()=>{
  return Number((imgWidth.value/imageWidth.value).toFixed(3))
})
const rateHeight = computed(()=>{
  return Number((imgHeight.value/imageHeight.value).toFixed(3))
})

// 监听图片的变化 获取 图片真实宽高
watch(image,(newvalue,_oldvalue)=>{
  if(!imgref.value) return
  const img:HTMLImageElement = new Image()
  img.src = newvalue
  img.onload = function(){
    imageWidth.value = img.width
    imageHeight.value = img.height
  }
})

// 初始化 禁止选择 右键菜单 滚轮监听
onMounted(async ()=>{
  if(imgref.value){
    imgref.value.onload = function(){
      if(imgref.value){
        imgref.value.src = image.value
        imgWidth.value = imgref.value.clientWidth
        imgHeight.value = imgref.value.clientHeight
      }
    }
  }

  image.value = ""
  image.value = images.value[imageIndex.value].httpsrc
  appWindow.setTitle("数据标注工具 图片名称："+images.value[imageIndex.value].name+" 总数：" +imagessearch.value.length+" 序号："+(imageIndex.value+1))

  document.getElementById('main')?.addEventListener("selectstart",(e)=>{
    e.preventDefault()
  })

  document.addEventListener("contextmenu",(e)=>{
    e.preventDefault()
  })

  document.getElementById("main")?.addEventListener("wheel",async (e:WheelEvent)=>{
    if(e.deltaY == 125){
      if(imageIndex.value < images.value.length-1){
        imageIndex.value = imageIndex.value + 1
        image.value = images.value[imageIndex.value].httpsrc
      }else{
        imageIndex.value = 0
        image.value = images.value[0].httpsrc
      }
    }else if(e.deltaY == -125){
      if(imageIndex.value !=0){
        imageIndex.value = imageIndex.value - 1
        image.value = images.value[imageIndex.value].httpsrc
      }else{
        imageIndex.value = images.value.length-1
        image.value = images.value[images.value.length-1].httpsrc
      }    
    }
    wheelchange()
  })

  wheelchange()
})

const wheelchange =async function(){
  input.value = ""
  appWindow.setTitle("数据标注工具 图片名称："+images.value[imageIndex.value].name+" 总数：" +imagessearch.value.length+" 序号："+(imageIndex.value+1))
  filename.value = images.value[imageIndex.value].name
  let path = await resolve(dirpath.value,"img",images.value[imageIndex.value].name)
  if(await exists(path)){
    corpImage.value = convertFileSrc(path)
  }else{
    corpImage.value = ""
  }

  left.value =0
  top.value = 0
  rectHeight.value =0
  rectWidth.value = 0

  let ext = await extname(filename.value)
  let name = filename.value.substring(filename.value.indexOf(ext)-1,-1)
  let txtpath = await resolve(dirpath.value as string,"txt","det",name+'.txt')
  if(await exists(txtpath)){
    let txt = await readTextFile(txtpath)
    let txtarr = txt.split("\t")
    let obj = JSON.parse(txtarr[1])
    console.log(obj)
    input.value = obj.transcription
    left.value = Number((obj.point[0][0]*rateWidth.value).toFixed(0))
    top.value = Number((obj.point[0][1]*rateHeight.value).toFixed(0))
    rectHeight.value = Number(((obj.point[3][1]-obj.point[0][1])*rateHeight.value).toFixed(0))
    rectWidth.value = Number(((obj.point[1][0]-obj.point[0][0])*rateWidth.value).toFixed(0))
  }
}

//#region  绘制div 鼠标事件
const rectShow = ref(false) 
const left = ref(0)
const top = ref(0)
const trueLeft = computed( ()=>{
  return Number((left.value/rateWidth.value).toFixed(0))
})
const trueTop = computed(()=>{
  return Number((top.value/rateHeight.value).toFixed(0))
})
const rectWidth = ref(0)
const rectHeight = ref(0)
const rectTrueWidth = computed(()=>{
  return Number((rectWidth.value/rateWidth.value).toFixed(0))
})
const rectTrueHeight = computed(()=>{
  return Number((rectHeight.value/rateHeight.value).toFixed(0))
})
const mouseX = ref(0)
const mouseY = ref(0)
const mouseDown = function(e:MouseEvent){
  let dom = document.getElementById("rect")
  if(dom){
    left.value = e.offsetX
    top.value = e.offsetY
    mouseX.value = e.x
    mouseY.value = e.y
    dom.style.left = left.value+'px'
    dom.style.top = top.value+'px'
    dom.style.width = '1px'
    dom.style.height = '1px'
    rectShow.value  = true
  }
}

const mouseMove = function(e:MouseEvent){
    if(!rectShow.value) return;
    let dom:HTMLDivElement = document.getElementById('rect') as HTMLDivElement
    rectWidth.value = Math.abs(e.x-mouseX.value) 
    rectHeight.value = Math.abs(e.y-mouseY.value) 
    dom.style.width = rectWidth.value+'px';
    dom.style.height = rectHeight.value+'px';
}

const filename = ref();
const mouseUp =async function(_e:MouseEvent){
  rectShow.value = false
  filename.value = await basename(decodeURI(image.value));
  await pic_crop()
}
//#endregion

const corpImage= ref("");
const pic_crop =async function(){
  let path = await resolve(dirpath.value,filename.value)
  let savepath = await resolve(dirpath.value,"img",filename.value)
  // save path check or create
  let checkpath = await resolve(dirpath.value,"img");
  let checkpathbool = await exists(checkpath)
  if(!checkpathbool){
    await mkdir(checkpath,{"recursive":true})
  }
  // screenshots
  await invoke("save_img",{path:path,x:trueLeft.value,y:trueTop.value,width:rectTrueWidth.value,height:rectTrueHeight.value,savepath:savepath})

  // ocr
  let checkbool = await exists(savepath)
  if(!checkbool){
    return
  }
  corpImage.value = "null.png"
  corpImage.value = convertFileSrc(savepath)
  let data:any =  await cmdjs(savepath)
  if(isArray(data.data)&&data.code == 100){
    input.value = ""
    for(let i = 0;i<data.data.length ; i++){
      input.value = input.value + data.data[i].text.replace(/(^\s*)|(\s*$)/g, "")
    }
  }else{
    ElMessage({
      "type":"error",
      "message":data.data
    })
  }
  console.log(data)
}

const create_det =async function(){
  let checkpath = await resolve(dirpath.value as string,"txt/det")
  let checkpathbool = await exists(checkpath)
  if(!checkpathbool){
    await mkdir(checkpath,{"recursive":true})
  }
  // box
  let lefttop = [trueLeft.value,trueTop.value]
  let righttop = [trueLeft.value + rectTrueWidth.value,trueTop.value]
  let rightbottom = [trueLeft.value+ rectTrueWidth.value,trueTop.value+rectTrueHeight.value]
  let leftbottom = [trueLeft.value,trueTop.value + rectTrueHeight.value]
  // create 文本检测 det txt
  let ext = await extname(filename.value)
  let name = filename.value.substring(filename.value.indexOf(ext)-1,-1)
  let txtpath = await resolve(dirpath.value as string,"txt","det",name+'.txt')
  let txtfile = await create(txtpath)
  let encoder = new TextEncoder();
  txtfile.write(encoder.encode(filename.value + '\t' + JSON.stringify({"transcription": input.value,"point":[lefttop,righttop,rightbottom,leftbottom]})))
  txtfile.close()
}

const create_rec =async function(){
  // txt path check or create
  let checkpath = await resolve(dirpath.value as string,"txt/rec")
  let checkpathbool = await exists(checkpath)
  if(!checkpathbool){
    await mkdir(checkpath,{"recursive":true})
  }
  // create 文本识别 rec txt
  let ext = await extname(filename.value)
  let name = filename.value.substring(filename.value.indexOf(ext)-1,-1)
  let txtpath = await resolve(dirpath.value as string,"txt","rec",name+'.txt')
  let txtfile = await create(txtpath)
  let encoder = new TextEncoder();
  txtfile.write(encoder.encode(filename.value + '\t' + input.value))
  txtfile.close()
}

// 创建和保存文本内容 修改数据状态
const saveData =async function(){
  let load = ElLoading.service({
    "text":"保存中..."
  })
  await create_det()
  await create_rec()
  images.value[imageIndex.value].bool = true
  imagessearch.value[imageIndex.value].bool = true
  load.close()
  ElMessage({
    "type":"success",
    "message":"已标注！"
  })
}

hotkeys("ctrl+s",(_e)=>{
  saveData()
})

// const cmd =async function(imagepath:string){
//   let exepath = await resolveResource("PaddleOCR-json\\PaddleOCR-json.exe")
//   let res = await invoke("get_paddle_ocr_json_result",{
//     exepath,
//     imagepath
//   })
//   console.log(res,imagepath)
//   return res as string;
// }

import { Command } from '@tauri-apps/plugin-shell';
const cmdjs = async function(imagepath:string){
  let data = "";
  let dir = await resolve(await resourceDir(),"PaddleOCR-json")
  console.log(dir,imagepath)
  let command = Command.create("PaddleOCR-json",
    [
      `-image_path=${imagepath}`
    ],
    {
      cwd:dir
    }
  )
  command.stdout.on("data",(res)=>{
    if(res.indexOf("code")>0){
      data = res
    }
  })
  await command.execute()
  return JSON.parse(data)
}

const imgsearch = ref("")

const timeId = ref(0);
const search = function(){
  clearTimeout(timeId.value)
  timeId.value = setTimeout(()=>{
    images.value = imagessearch.value.filter((item)=>{
      return item.name.indexOf(imgsearch.value)>=0
    })
    console.log(images.value,imgsearch.value)
  },100)
  
}

// rec 文本识别  det 文本检测
//  解决 已标记数据 和 未标注数据 的保存 和 读取 、 标注数据文件夹快捷打开、 是鼠标弹起保存还是按键保存 或者 设计一个浮窗 用于 方便文本填写  
// 同一个图片 多数据标注的情况下 文件和数据对应关系
</script>

<template>
  <el-container class="container">
      <el-aside class="aside" :width="`${asideWidth}px`">
          <el-button type="primary" class="asidebtn" @click="openfile">选择文件</el-button>
          <el-button type="primary" class="asidebtn" @click="opendir">选择文件夹</el-button>
        <div class="asidemessage">
          <div class="flex" style="width: 50px;">TW:</div>
          <div class="flex-left" style="width: 50px;">
            {{ imageWidth }}
          </div>
        </div>
        <div class="asidemessage">
          <div class="flex" style="width: 50px;">TH:</div>
          <div class="flex-left" style="width: 50px;">
            {{ imageHeight }}
          </div>  
        </div>
        <div class="asidemessage">
          <div class="flex" style="width: 50px;">L:</div>
          <div class="flex-left" style="width: 50px;">
            {{ trueLeft }}
          </div>  
        </div>
        <div class="asidemessage">
          <div class="flex" style="width: 50px;">T:</div>
          <div class="flex-left" style="width: 50px;">
            {{ trueTop }}
          </div>  
        </div>
        <div class="asidemessage">
          <div class="flex" style="width: 50px;">RW:</div>
          <div class="flex-left" style="width: 50px;">
            {{ rectTrueWidth }}
          </div>  
        </div>
        <div class="asidemessage">
          <div class="flex" style="width: 50px;">RH:</div>
          <div class="flex-left" style="width: 50px;">
            {{ rectTrueHeight }}
          </div>  
        </div>
        <el-input style="width: calc(100% - 20px);margin: 10px 0px;" type="textarea" v-model="input" placeholder="目标文本" :show-word-limit="true" :autosize="{minRows:4,maxRows: 10}"></el-input>
        <el-button type="primary" class="asidebtn" @click="saveData">标注</el-button>
        <img :src="corpImage?corpImage:'null.png'" style="width: 180px;height: 180px;object-fit: contain;box-shadow: 0px 0px 5px black;border-radius: 5px;" />
      </el-aside>
      <el-aside id="imglist" class="imglist" style="">
        <el-input @input="search" @keyup.enter="search" v-model="imgsearch" class="imginput" placeholder="搜索"></el-input>
        <div class="imglistcon">
          <div class="imglistitem" :style="{background:(index==imageIndex) ? 'pink':'rgba(250,250,250,1)',border:item.bool?'1px solid black':'none'}" v-for="(item,index) in images" @click="image = item.httpsrc;imageIndex = index;wheelchange()">
            {{ item.name }}
          </div>        
        </div>
  
      </el-aside>
      <el-main id="main" ref="mainref" class="main">
        <div class="area">
            <div class="area_img_div">
              <img ref="imgref" :style="{width:(imgref&&imageWidth>imageHeight)?'100%':'auto',height:(imgref&&imageWidth>imageHeight)?'auto':'100%'}" :src="image" v-show="image?true:false" />
            </div>
            <div class="area_div">
              <!-- @mouseleave="rectShow = false" @mousedown="mouseDown($event)" @mousemove="mouseMove($event)" @mouseup="mouseUp($event)" -->
              <div :style="{width:imgWidth+'px',height:imgHeight+'px',position:'relative'}" @mouseleave="rectShow = false" @mousedown="mouseDown($event)" @mousemove="mouseMove($event)" @mouseup="mouseUp($event)" >
                <div v-show="rectShow" id="rect" class="rect"></div>
              </div>
            </div>
        </div>
      </el-main>
  </el-container>
</template>

<style lang="less">
.container{
  width: 100%;
  height: 100vh;
  padding: 0;

  .aside{
    padding-top: 10px;
    display: flex;
    flex-direction: column;
    justify-content: start;
    align-items: center;
    .asidebtn{
      width: calc(100% - 20px); ;
      margin-bottom: 10px;
      margin-left: 0;
      height: 30px;
      filter: drop-shadow(0px 0px 2px black);
      font-size: 12px !important;
    }
    .asidemessage{
      width: calc(100% - 20px);
      height: 30px;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 12px;
      background: rgba(245,245,245,0.5);
      margin: 5px 10px;
      border-radius: 5px;
      filter: drop-shadow(0px 0px 2px black);
    }
  }
  .imglist{
    width: 300px;
    font-size: 12px;
    background-color:rgba(20,250,250,1);
    display: flex;
    flex-direction: column;
    justify-content: start;
    align-items: start;
    box-sizing: border-box;
    overflow: hidden;
    .imginput{
      width:calc(100% - 20px);
      height: 30px;
      margin: 10px;
      filter: drop-shadow(0px 0px 5px rgba(100,100,100,1));
      border-radius: 5px;
    }
    .imglistcon{
      overflow-y: scroll;
      width:100%;
      height: calc(100% - 40px);
      .imglistitem{
        width: calc(100% - 20px);
        text-wrap: nowrap;
        background: rgba(230,230,230,0.8);
        padding: 5px;
        box-sizing: border-box;
        margin: 10px;
        box-shadow: 0px 0px 5px black;
        border-radius: 5px;
        cursor: pointer;
      }
    }
  }
  .main{
    width: 100%;
    height: 100%;
    padding: 0 !important;
    position: relative;
    .area{
      position: relative;
      width: 100%;
      height: 100%;
      .area_img_div{
        position: absolute;
        z-index: 50;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(225,225,225,1);
      }
      .area_div{
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        position: absolute;
        z-index: 100;
        justify-content: center;
        display: flex;
        align-items: center;
        .rect{
          position: absolute;
          z-index: 200;
          width: 100%;
          height: 100%;
          background: rgba(123,123,123,0.5);

        }
      }
    }
  }
}

::-webkit-scrollbar{
  display: none;
}
</style>

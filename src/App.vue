<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { opendir,openfile } from './function';
import { create,exists,readTextFile,writeTextFile, writeFile,mkdir} from '@tauri-apps/plugin-fs';
import { appLocalDataDir, extname, resolve,resourceDir} from '@tauri-apps/api/path';
import { convertFileSrc} from '@tauri-apps/api/core';
import { storeToRefs } from "pinia"
import { containersStore } from './store';
import { getCurrent } from '@tauri-apps/api/webviewWindow';
import { Command } from '@tauri-apps/plugin-shell';
import { fabric } from 'fabric'
import { isArray } from 'element-plus/es/utils/types.mjs';
import { ElMessage,ElLoading } from 'element-plus';

// 页面参数
const input = ref("")
const appWindow = getCurrent()
let canvas:fabric.Canvas
let cv:fabric.Canvas
// store 参数
const c = containersStore()
const { images,image,dirpath,imageIndex,imagessearch,filename }  = storeToRefs(c)
const labeldata = ref<any[]>([])
const labelindex = ref(0)
const rectindex = ref(0)
//#region  图片选择
interface imgType {
    httpsrc:string
    path:string,
    name:string,
    bool:boolean
}
const getImage = async function(type:string){
  let arr:imgType[] | undefined;
  if(type == 'file'){
    arr = await openfile()
  }else if(type == 'dir'){
    arr = await opendir()
  }
  if(arr != undefined){
    images.value = arr
    imagessearch.value = arr
    imageIndex.value = 0
    image.value = images.value[imageIndex.value].httpsrc
    filename.value = images.value[imageIndex.value].name
    dirpath.value = images.value[imageIndex.value].path.substring(0,images.value[imageIndex.value].path.indexOf(filename.value))
    appWindow.setTitle("数据标注工具 图片名称："+images.value[imageIndex.value].name+" 总数：" +imagessearch.value.length+" 序号："+(imageIndex.value+1))

    let txtpath = await resolve(dirpath.value,'label.txt')
    if(!(await exists(txtpath))){
      await create(txtpath)
    }
    let txt = await readTextFile(txtpath)
    if(txt){
      let arr:any[] = JSON.parse(txt)
      labeldata.value = arr
    }else{
      labeldata.value = []
    }

    let imgpath = await resolve(dirpath.value,"img");
    if(!(await exists(imgpath))){
      await mkdir(imgpath)
    }    
  }
}
//#endregion

// 监听图片的变化 获取 图片真实宽高
const imageWidth = ref(0)
const imageHeight = ref(0)
const imgWidth = ref(0)
const imgHeight = ref(0)
watch(image,(newvalue,_oldvalue)=>{
  const img:HTMLImageElement = new Image()
  img.src = newvalue
  img.onload = function(){
    imageWidth.value = img.width
    imageHeight.value = img.height
    let dom = document.getElementById("img")
    if(!dom) return
    if(imageWidth.value >= imageHeight.value){
      imgWidth.value = dom.clientWidth
      imgHeight.value = Math.round(imageHeight.value * (imgWidth.value / imageWidth.value))
    }else{
      imgHeight.value = dom.clientHeight
      imgWidth.value = Math.round(imageWidth.value * (imgHeight.value / imageHeight.value))
    }
    canvas.setWidth(imgWidth.value)
    canvas.setHeight(imgHeight.value)
    input.value = ""
    appWindow.setTitle("数据标注工具 图片名称："+images.value[imageIndex.value].name+" 总数：" +imagessearch.value.length+" 序号："+(imageIndex.value+1))
    filename.value = images.value[imageIndex.value].name,
    // 移除所有标注
    canvas.clear();
    let index = 0
    let arr:any = labeldata.value.filter((item,i)=>{
      if(item.name == filename.value){
        index = i
        return true
      }
    })
    // 初始化已标记
    if(arr.length == 1){
      labelindex.value = index
      arr[0].data.forEach((item:any) => {
        let rect = new fabric.Rect({
          left:item.left * (imgWidth.value/imageWidth.value) ,
          top:item.top * (imgWidth.value/imageWidth.value),
          width:item.width * (imgWidth.value/imageWidth.value),
          height:item.height * (imgWidth.value/imageWidth.value),
          stroke: 'black',
          strokeWidth:1,
          fill:undefined,
          name:item.name,
          angle:item.angle
        })
        canvas.add(rect)
        canvas.renderAll()
      });
    }else{
      labelindex.value = labeldata.value.length
    }
    let collapse_dom = document.getElementById('collapse')
    collapse_dom?.scrollTo({
      "behavior":'smooth',
      "top":48*labelindex.value,
    })
  }
},{
  "immediate":true,
})

const savelabel = async function(){
  let txt = JSON.stringify(labeldata.value)
  let txtpath = await resolve(dirpath.value,'label.txt')
  await writeTextFile(txtpath,txt)
}

// 根据窗口变化更新画布宽高
window.onresize = function(){
  let dom = document.getElementById("img")
  if(!dom) return
  let oldw = imgWidth.value
  let oldh = imgHeight.value
  if(imageWidth.value >= imageHeight.value){
    imgWidth.value = dom.clientWidth
    imgHeight.value = Math.round(imageHeight.value * (imgWidth.value / imageWidth.value))
  }else{
    imgHeight.value = dom.clientHeight
    imgWidth.value = Math.round(imageWidth.value * (imgHeight.value / imageHeight.value))
  }
  console.log(dom.clientWidth,dom.clientHeight)
  console.log(imgWidth.value,imgHeight.value)
  let obj = canvas.getObjects()
  obj.forEach((e:fabric.Object)=>{
    if(e.scaleX){
      e.scaleX *= imgWidth.value/oldw
    }
    if(e.scaleY){
      e.scaleY *= imgHeight.value/oldh
    }
    if(e.left){
      e.left *= imgWidth.value/oldw
    }
    if(e.top){
      e.top *= imgHeight.value/oldh
    }
  })
  canvas.setWidth(imgWidth.value)
  canvas.setHeight(imgHeight.value)
  canvas.renderAll()
}

//#region  初始化 禁止选择 右键菜单 滚轮监听
onMounted(async ()=>{
  // appWindow.setAlwaysOnTop(true)
  fabricinit('c')
  fabricrect()
  cv = new fabric.Canvas('cv')
  let txtpath = await resolve(dirpath.value,'label.txt')
  if(!(await exists(txtpath))){
    await create(txtpath)
  }
  let txt = await readTextFile(txtpath)
  if(txt){
    let arr:any[] = JSON.parse(txt)
    labeldata.value = arr
  }else{
    labeldata.value = []
  }

  let index = 0
  let arr:any = labeldata.value.filter((item,i)=>{
    if(item.name == filename.value){
      index = i
      return true
    }
  })
  // 初始化已标记
  if(arr.length == 1){
    labelindex.value = index
    arr[0].data.forEach((item:any) => {
      let rect = new fabric.Rect({
        left:item.left * (imgWidth.value/imageWidth.value) ,
        top:item.top * (imgWidth.value/imageWidth.value),
        width:item.width * (imgWidth.value/imageWidth.value),
        height:item.height * (imgWidth.value/imageWidth.value),
        stroke: 'black',
        strokeWidth:1,
        fill:undefined,
        name:item.name,
        angle:item.angle
      })
      canvas.add(rect)
      canvas.renderAll()
    });
  }else{
    labelindex.value = labeldata.value.length
  }

  // 监听滚轮事件
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
  },{
    "passive":true
  })
})
//#endregion

//#region 图片搜索
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
//#endregion

//#region 截图 + 识别
// const pic_crop =async function(path:string,x:number,y:number,width:number,height:number,savepath:string){
//   await invoke("save_img",{path:path,x:x,y:y,width:width,height:height,savepath:savepath})
//   // ocr
//   let checkbool = await exists(savepath)
//   if(!checkbool){
//     return
//   }
//   // "?tempid="+Math.random()

//   let data:any =  await cmdjs(savepath)
//   if(isArray(data.data)&&data.code == 100){
//     input.value = ""
//     for(let i = 0;i<data.data.length ; i++){
//       input.value = input.value + data.data[i].text.replace(/(^\s*)|(\s*$)/g, "")
//     }
//   }else{
//     ElMessage({
//       "type":"error",
//       "message":data.data
//     })
//   }
// }
//#endregion


//#region 调用paddleocr-json 识别截图内容
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
//#endregion

//#region  初始化画布
const fabricinit = function(id:string){
  fabric.Object.prototype.transparentCorners = false;
  fabric.Object.prototype.cornerColor = 'rgba(0,0,0,1)';
  fabric.Object.prototype.cornerStyle = 'circle';
  fabric.Object.prototype.cornerSize = 12
  // 删除
  function deleteObject(_eventData:any, transform:any) {
		let target = transform.target;
		let canvas = target.canvas;
    let index = labeldata.value.findIndex(item=>{
      return item.name == filename.value
    })
    console.log(transform)
    if(target._objects != undefined){
      target._objects.forEach((e:any) => {
        canvas.remove(e);
        canvas.requestRenderAll();
        canvas.discardActiveObject();
        labeldata.value[index].data.filter((item:any,i:any)=>{
          if(item.name == e.name){
            labeldata.value[index].data.splice(i,1)
          }
        })
      });
    }else{
      let name = target.name
      canvas.remove(target);
      canvas.requestRenderAll();
      canvas.discardActiveObject();
      labeldata.value[index].data.filter((item:any,i:any)=>{
        console.log(item.name,name)
        if(item.name == name){
          labeldata.value[index].data.splice(i,1)
        }
      })
    }
    canvas.clear()
    labeldata.value[index].data.filter((item:any,i:any)=>{
        console.log(i)
        labeldata.value[index].data[i].name = i.toString()
        let rect = new fabric.Rect({
        left:item.left * (imgWidth.value/imageWidth.value) ,
        top:item.top * (imgWidth.value/imageWidth.value),
        width:item.width * (imgWidth.value/imageWidth.value),
        height:item.height * (imgWidth.value/imageWidth.value),
        stroke: 'black',
        strokeWidth:1,
        fill:undefined,                                                                                                                                                             
        name:i.toString(),
        angle:item.angle
      })
      canvas.add(rect)
      canvas.requestRenderAll();
    })
    if(labeldata.value[index].data.length == 0){
      labeldata.value.splice(index,1)
    }
    savelabel()
    return true
  }
  const renderIcon = function(ctx: CanvasRenderingContext2D, left: number, top: number, _styleOverride: any, fabricObject: fabric.Object) {
    var deleteIcon = "data:image/svg+xml,%3C%3Fxml version='1.0' encoding='utf-8'%3F%3E%3C!DOCTYPE svg PUBLIC '-//W3C//DTD SVG 1.1//EN' 'http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd'%3E%3Csvg version='1.1' id='Ebene_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' width='595.275px' height='595.275px' viewBox='200 215 230 470' xml:space='preserve'%3E%3Ccircle style='fill:%23F44336;' cx='299.76' cy='439.067' r='218.516'/%3E%3Cg%3E%3Crect x='267.162' y='307.978' transform='matrix(0.7071 -0.7071 0.7071 0.7071 -222.6202 340.6915)' style='fill:white;' width='65.545' height='262.18'/%3E%3Crect x='266.988' y='308.153' transform='matrix(0.7071 0.7071 -0.7071 0.7071 398.3889 -83.3116)' style='fill:white;' width='65.544' height='262.179'/%3E%3C/g%3E%3C/svg%3E";
    var img = document.createElement('img');
    img.src = deleteIcon;
    let size = 15
    ctx.save();
    ctx.translate(left, top);
    ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle as number));
    ctx.drawImage(img, -size/2, -size/2, size, size);
    ctx.restore();
  }
  fabric.Object.prototype.controls.deleteControl = new fabric.Control({
    x: 0.5,
    y: -0.5,
    cursorStyle: 'pointer',
    mouseUpHandler: deleteObject,
    render: renderIcon,
    offsetX: 0,
    offsetY: -35
  });

  canvas= new fabric.Canvas(id,{
    selection:true,
  })
}
//#endregion

// 监听键盘r 用于rect绘制
document.addEventListener("keydown",(e: KeyboardEvent)=>{
  if(e.key == 'r'){
    rectbool.value = true
  }
})
document.addEventListener("keyup",(e: KeyboardEvent)=>{
  if(e.key == 'r'){
    rectbool.value = false
  }
})

//#region fabric 绘制rect监听
const rectbool =ref<boolean>(false)
const fabricrect = function(){
  let index = 0;
  let shape:fabric.Object | null;
  let startPoint:fabric.Point;
  if(!canvas) return
  canvas.on("mouse:down",async (e)=>{
    if(!rectbool.value) return
    if(!e.absolutePointer) return
    if(!canvas) return
    let arr = labeldata.value.filter(item=>{
      return item.name == filename.value
    })
    if(arr.length == 1){
      index = arr[0].data.length
    }else{
      labeldata.value.push({
        name:filename.value,
        data:[]
      })
      index = 0
    }
    startPoint = e.absolutePointer
    shape = new fabric.Rect({ //创建对应图形类型
      left: startPoint.x,
      top: startPoint.y,
      width: 0,
      height: 0,
      stroke: 'black',
      fill:undefined,
      strokeWidth:1,
      name:index.toString(),
    });
    if(shape){
      canvas.add(shape)
      canvas.setActiveObject(shape);
      canvas.requestRenderAll()
    }
  }).on("mouse:move",(e: fabric.IEvent<MouseEvent>)=>{
    if(!e.absolutePointer) return
    if(!rectbool.value) return
    if(!shape) return
    if(!canvas) return
    const p = canvas.getPointer(e.e) || {
      x: 0,
      y: 0,
    };
    const minX = Math.min(p.x, startPoint.x);
    const minY = Math.min(p.y, startPoint.y);
    let w = Math.abs(p.x - startPoint.x);
    let h = Math.abs(p.y - startPoint.y);
    shape.set({
      left:minX,
      top:minY,
      width:w,
      height:h,
    })
    canvas.requestRenderAll()
  }).on("mouse:up",(_e)=>{
    if(!canvas) return
    if(!shape) return
    rectbool.value = false
    shape.setCoords(); // 更新图像坐标；
    canvas.requestRenderAll(); 
   
    let coords = shape.getCoords()
    let angle = shape.angle
    let left = Math.round(shape.left as number / (imgWidth.value/imageWidth.value))
    let top = Math.round(shape.top as number / (imgWidth.value/imageWidth.value))
    let width = Math.round(shape.width as number / (imgWidth.value/imageWidth.value))
    let height = Math.round(shape.height as number / (imgWidth.value/imageWidth.value))
    let name = shape.name
    coords.forEach(item=>{
        item.x = Math.round(item.x/(imgWidth.value/imageWidth.value))
        item.y = Math.round(item.y/(imgHeight.value/imageHeight.value))
        return 
    })
    labeldata.value.filter((item,i)=>{
      if(item.name == filename.value){
          labeldata.value[i].data.push({
          name,
          data:input.value,
          coords,
          angle,
          left,
          top,
          width,
          height
        })
      }
    })
    shape = null;
    savelabel()
  }).on("object:moving",(e: fabric.IEvent<MouseEvent>)=>{
    // 移动
    if(!e.target) return
    let coords = e.target.getCoords()
    let name = e.target.name
    let left = Math.round(e.target.left as number / (imgWidth.value/imageWidth.value))
    let top = Math.round(e.target.top as number / (imgWidth.value/imageWidth.value))
    let width = Math.round(e.target.width as number / (imgWidth.value/imageWidth.value))
    let height = Math.round(e.target.height as number / (imgWidth.value/imageWidth.value))
    coords.forEach(item=>{
        item.x = Math.round(item.x/(imgWidth.value/imageWidth.value))
        item.y = Math.round(item.y/(imgHeight.value/imageHeight.value))
        return 
    })
    labeldata.value.filter((item,i)=>{
      if(item.name == filename.value ){
        item.data.filter((e:any,j:any)=>{
          if(e.name == name){
            labeldata.value[i].data[j].coords = coords
            labeldata.value[i].data[j].left = left
            labeldata.value[i].data[j].top = top
            labeldata.value[i].data[j].width = width
            labeldata.value[i].data[j].height = height
          }
        })
      }
    })
    savelabel()
  }).on("object:rotating",(e: fabric.IEvent<MouseEvent>)=>{
    // 旋转
    if(!e.target) return
    let coords = e.target.getCoords()
    let name = e.target.name
    let angle = e.target.angle
    let left = Math.round(e.target.left as number / (imgWidth.value/imageWidth.value))
    let top = Math.round(e.target.top as number / (imgWidth.value/imageWidth.value))
    let width = Math.round(e.target.width as number / (imgWidth.value/imageWidth.value))
    let height = Math.round(e.target.height as number / (imgWidth.value/imageWidth.value))
    coords.forEach(item=>{
        item.x = Math.round(item.x/(imgWidth.value/imageWidth.value))
        item.y = Math.round(item.y/(imgHeight.value/imageHeight.value))
        return 
    })
    labeldata.value.filter((item,i)=>{
      if(item.name == filename.value ){
        item.data.filter((e:any,j:any)=>{
          if(e.name == name){
            labeldata.value[i].data[j].coords = coords
            labeldata.value[i].data[j].angle = angle
            labeldata.value[i].data[j].left = left
            labeldata.value[i].data[j].top = top
            labeldata.value[i].data[j].width = width
            labeldata.value[i].data[j].height = height
          }
        })
      }
    })
    savelabel()
  }).on("object:scaling",(e: fabric.IEvent<MouseEvent>)=>{
    if(!e.target) return
    let coords = e.target.getCoords()
    let name = e.target.name
    let left = Math.round(e.target.left as number / (imgWidth.value/imageWidth.value))
    let top = Math.round(e.target.top as number / (imgWidth.value/imageWidth.value))
    let width = Math.round(e.target.getScaledWidth()/ (imgWidth.value/imageWidth.value))
    let height = Math.round(e.target.getScaledHeight()/ (imgWidth.value/imageWidth.value))
    coords.forEach(item=>{
        item.x = Math.round(item.x/(imgWidth.value/imageWidth.value))
        item.y = Math.round(item.y/(imgHeight.value/imageHeight.value))
        return 
    })
    labeldata.value.filter((item,i)=>{
      if(item.name == filename.value ){
        item.data.filter((e:any,j:any)=>{
          if(e.name == name){
            labeldata.value[i].data[j].coords = coords
            labeldata.value[i].data[j].left = left
            labeldata.value[i].data[j].top = top
            labeldata.value[i].data[j].width = width
            labeldata.value[i].data[j].height = height
          }
        })
      }
    })
    savelabel()
  }).on("selection:created",(e: fabric.IEvent<MouseEvent>)=>{
    if(!e.selected) return
    rectindex.value = Number(e.selected[0].name)
    input.value = ''
    console.log(e)
  }).on("selection:updated",(e: fabric.IEvent<MouseEvent>)=>{
    if(!e.selected) return
    rectindex.value = Number(e.selected[0].name)
    input.value = ''
    console.log(e)
  })
}
//#endregion 

//#region  截图
const corpimage = async function(dir:string,name:string,data:{
  coords:{
    x:number,
    y:number
  }[],
  name:string,
  angle:number,
  left:number,
  top:number,
  width:number,
  height:number
}){

  let getcorpstr = new Promise(async (resolve2,_reject)=>{
    let imagepath = await resolve(dir,name)
    let httpsrc = convertFileSrc(imagepath)
    let img = new Image()
    img.src = httpsrc
    img.onload = function(){
      let width = img.width
      let height = img.height
      let angle = 0;
      let base64str = ''
      fabric.Image.fromURL(httpsrc,(fabricimg)=>{
        cv.setWidth((Math.abs(width * Math.cos(Math.PI*data.angle/180.0)) + Math.abs(height * Math.sin(Math.PI*data.angle/180.0))))
        cv.setHeight((Math.abs(height * Math.cos(Math.PI*data.angle/180.0)) + Math.abs(width * Math.sin(Math.PI*data.angle/180.0))))
        if(data.angle>=0&&data.angle<90){
          angle = data.angle
        }else if(data.angle>=90&&data.angle<180){
          angle = data.angle-90
        }else if(data.angle>=180&&data.angle<270){
          angle = data.angle - 180
        }else{
          angle = data.angle - 270
        }
        cv.clear();
        cv.setBackgroundColor('black',()=>{})
        cv.add(fabricimg)
        cv.centerObject(fabricimg)
        cv.renderAll()
        
        if(data.angle>=0&&data.angle<90){
            base64str = cv.toDataURL({
            format:'jpeg',
            width:data.width,
            height:data.height,
            left:(data.left + data.top * Math.abs(Math.tan(Math.PI*angle/180.0))) * Math.abs(Math.cos(Math.PI*angle/180)),
            top:(data.top + (width - data.left) * Math.abs(Math.tan(Math.PI*angle/180.0))) * Math.abs(Math.cos(Math.PI*angle/180))
          })
        }else if(data.angle>=90&&data.angle<180){
          base64str = cv.toDataURL({
            format:'jpeg',
            width:data.width,
            height:data.height,
            left:(data.top + (width - data.left ) * Math.abs(Math.tan(Math.PI*angle/180.0))) * Math.abs(Math.cos(Math.PI*angle/180)),
            top:(Math.abs(height * Math.cos(Math.PI*data.angle/180.0)) + Math.abs(width * Math.sin(Math.PI*data.angle/180.0))) - (data.left + data.top * Math.abs(Math.tan(Math.PI*angle/180.0))) * Math.abs(Math.cos(Math.PI*angle/180))
          })
        }else if(data.angle>=180&&data.angle<270){
          base64str = cv.toDataURL({
            format:'jpeg',
            width:data.width,
            height:data.height,
            left:((width - data.left) + (height-data.top) * Math.abs(Math.tan(Math.PI*angle/180.0))) * Math.abs(Math.cos(Math.PI*angle/180)),
            top:((height - data.top) + data.left * Math.abs(Math.tan(Math.PI*angle/180.0))) * Math.abs(Math.cos(Math.PI*angle/180)),
          })
        }else{
          base64str = cv.toDataURL({
            format:'jpeg',
            width:data.width,
            height:data.height,
            top:(data.left + data.top * Math.abs(Math.tan(Math.PI*angle/180.0))) * Math.abs(Math.cos(Math.PI*angle/180)),
            left:((height - data.top) + data.left * Math.abs(Math.tan(Math.PI*angle/180.0))) * Math.abs(Math.cos(Math.PI*angle/180)),
          })
        }
        cv.clear();
        resolve2(base64str)
      },{
        angle:-data.angle,
        hasControls:false,
        crossOrigin:"anonymous",
        selectable:false
      })
    }
  })

  return await getcorpstr
}

//#endregion

const clipimage =async function(){
  let loading = ElLoading.service({
    "text":"生成截图中..."
  })
  for(let i = 0;i<labeldata.value.length; i++){
    console.log(i)
    for(let j = 0;j<labeldata.value[i].data.length;j++){
      let base64str:string = await corpimage(dirpath.value,labeldata.value[i].name,labeldata.value[i].data[j]) as string
      let blob:Blob = b64ToBlob(base64str)
      let ext = await extname(labeldata.value[i].name)
      let path = await resolve(dirpath.value,"img",labeldata.value[i].name.substring(0,labeldata.value[i].name.indexOf(ext)-1)+'_'+j+'.jpg')
      await writeFile(path,(new Uint8Array(await blob.arrayBuffer())))
    }
  }
  loading.close()
}

const cliponeimage = async function(){
  let base64str:string = await corpimage(dirpath.value,labeldata.value[labelindex.value].name,labeldata.value[labelindex.value].data[rectindex.value]) as string
  let blob:Blob = b64ToBlob(base64str)
  let ext = await extname(labeldata.value[labelindex.value].name)
  let localdatapath = await appLocalDataDir()
  let path = await resolve(localdatapath,'ocr.'+ext)
  await writeFile(path,(new Uint8Array(await blob.arrayBuffer())))

  let data:any =  await cmdjs(path)
  if(isArray(data.data)&&data.code == 100){
    input.value = ""
    for(let i = 0;i<data.data.length ; i++){
      input.value = input.value + data.data[i].text.replace(/(^\s*)|(\s*$)/g, "")
    }
    labeldata.value[labelindex.value].data[rectindex.value].data = input.value
  }else{
    ElMessage({
      "type":"error",
      "message":data.data
    })
  }
}

const b64ToBlob = function(urlData:string) {
  var arr:any[] = urlData.split(',');
  var mime = arr[0].match(/:(.*?);/)[1] || 'image/jpeg';
  // 去掉url的头，并转化为byte
  var bytes = window.atob(arr[1]);
  // 处理异常,将ascii码小于0的转换为大于0
  var ab = new ArrayBuffer(bytes.length);
  // 生成视图（直接针对内存）：8位无符号整数，长度1个字节
  var ia = new Uint8Array(ab);
  for (var i = 0; i < bytes.length; i++) {
      ia[i] = bytes.charCodeAt(i);
  }
  return new Blob([ab], {
      type: mime
  });
}

const collapseselect = function(name:string){
  images.value.filter((item,index)=>{
    if(name == item.name){
      image.value = item.httpsrc
      imageIndex.value = index
    }
  })
}

// 记录label文本
const inputchange = function(e:string){
  labeldata.value[labelindex.value].data[rectindex.value].data = e
  savelabel()
}

const mergetxt = async function(){
  let loading = ElLoading.service({
    "text":"文本生成中..."
  })
  let txtpath = await resolve(dirpath.value,'txt')
  if(!(await exists(txtpath))){
    await mkdir(txtpath)
  }

  let det = '';
  let rec = '';
  for(let i = 0;i<labeldata.value.length;i++){
    // {"transcription": "MASA", "points": [[310, 104], [416, 141], [418, 216], [312, 179]]},
    let detobj:{
      transcription:string,
      points:number[][]
    }[] = []
    for(let j =0;j<labeldata.value[i].data.length;j++){
      let ext = await extname(labeldata.value[i].name)
      let name = labeldata.value[i].name.substring(0,labeldata.value[i].name.indexOf(ext)-1)
      rec = rec + labeldata.value[i].name + '\t' + name+'-'+j.toString()+'.'+ext + '\n'
      detobj.push({
        transcription:labeldata.value[i].data[j].data,
        points:[
          [labeldata.value[i].data[j].coords[0].x,labeldata.value[i].data[j].coords[0].y],
          [labeldata.value[i].data[j].coords[1].x,labeldata.value[i].data[j].coords[1].y],
          [labeldata.value[i].data[j].coords[2].x,labeldata.value[i].data[j].coords[2].y],
          [labeldata.value[i].data[j].coords[3].x,labeldata.value[i].data[j].coords[3].y]
        ]
      })
    }
    det = det + labeldata.value[i].name + '\t' + JSON.stringify(detobj) + '\n'
  }

  let detpath = await resolve(txtpath,'det.txt')
  await writeTextFile(detpath,det)
  let recpath = await resolve(txtpath,'rec.txt')
  await writeTextFile(recpath,rec)

  loading.close()
}
</script>

<template>
  <el-container class="container">
      <el-aside class="aside" :width="`200px`">
        <div style="width: calc(100% - 20px);display: flex;flex-direction: row;margin: 0px 10px;margin-bottom: 10px;">
          <el-button style="font-size: 12px;width: 50%;filter: drop-shadow(0px 0px 2px black);" type="primary" @click="getImage('file')">文件</el-button>
          <el-button style="font-size: 12px;width: 50%;filter: drop-shadow(0px 0px 2px black);" type="primary" @click="getImage('dir')">文件夹</el-button>
        </div>
        <div class="asidemessage">
          <div class="flex" style="width: 50px;">W-H:</div>
          <div class="flex-left" style="width: 130px;">
            {{ imageWidth + " - " + imageHeight }}
          </div>
        </div>
        <el-input style="width: calc(100% - 20px);margin: 10px 0px;" type="textarea" v-model="input" @input="inputchange" placeholder="目标文本" show-word-limit maxlength="1000" :autosize="{minRows:4,maxRows: 10}"></el-input>
        <el-button type="primary" class="asidebtn" @click="clipimage">生成OCR图片</el-button>
        <el-button class="asidebtn" type="primary" @click="mergetxt" >生成OCR文本</el-button>
        <div id="collapse" style="width: calc(100% - 20px);height: 50%;overflow: hidden;overflow-y: scroll;">
          <el-collapse class="collapse" v-model="labelindex">
          <el-collapse-item @click="collapseselect(label.name)" v-for="(label,i) in labeldata" :name="i">
            <template #title>
                <div class="el-collapse-item-title">{{ label.name }}</div>
            </template>
            <div class="collapse-div" :style="{background:(labelindex == i && rectindex == index)?'rgba(123,123,123,0.3)':'rgba(123,123,123,0.1)'}" v-for="(data,index) in label.data">
              <div style="display: flex;">
                <div style="width: 40px;">NO:</div><div style="width: 40px;">{{ index+1 }} </div>
                <div style="width: 40px;">Angle:</div style="width: 40px;"><div>{{ data.angle.toFixed(4) }}</div>
              </div>
              <div style="display: flex">
                <div style="width: 40px;">Left:</div><div style="width: 40px;">{{ data.left }}</div>
                <div style="width: 40px;">Top:</div><div style="width: 40px;">{{ data.top }}</div>
              </div>
              <div style="display: flex">
                <div style="width: 40px;">Width:</div><div style="width: 40px;">{{ data.width }}</div>
                <div style="width: 40px;">Height:</div><div style="width: 40px;">{{ data.height }}</div>
              </div>
              <div style="display: flex">
                <div style="width: 40px;">Text:</div><div style="width: 120px;overflow: hidden">{{ data.data }}</div>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
        </div>
      </el-aside>
      <el-aside id="imglist" class="imglist">
        <el-input @input="search" @keyup.enter="search" v-model="imgsearch" class="imginput" placeholder="搜索"></el-input>
        <div class="imglistcon">
          <div class="imglistitem" :style="{background:(item.bool?'#07485b':(index==imageIndex)?'#8ec7d2':'rgba(250,250,250,1)')}" v-for="(item,index) in images" @click="image = item.httpsrc;imageIndex = index;">
            {{ item.name }}
            <el-icon v-show="item.bool"><check/></el-icon>
          </div>        
        </div>
      </el-aside>
      <el-main id="main" class="main">
        <div class="area">
            <div class="area_img_div">
              <img id="img" style="object-fit:contain;width: 100%;height: 100%;opacity: 1;" :src="image" v-show="image?true:false" />
            </div>
            <div class="area_div">
              <div :style="{width:imgWidth+'px',height:imgHeight+'px',position:'relative'}">
                <canvas id="c"></canvas>
              </div>
            </div>
        </div>
      </el-main>
      <div class="deletebtn">
        <!-- zrrect deleteimg -->
        <el-button circle type="danger" @click="cliponeimage()">
          <template #icon>
            <div style="font-style: normal;">
              ocr
            </div>
          </template>
        </el-button>
      </div>
      <div v-show="false">
        <canvas id="cv" ></canvas>
      </div>
      
  </el-container>
</template>

<style lang="less">
.container{
  position: relative;
  width: 100%;
  height: 100vh;
  padding: 0;
  .deletebtn{
    width: 80px;
    height: 80px;
    position: absolute;
    z-index: 400;
    left: 510px;
    top: 10px;
  }
  .aside{
    padding-top: 10px;
    display: flex;
    flex-direction: column;
    justify-content: start;
    align-items: center;
    .collapse {
      width:100%;
      .el-collapse-item-title {
            width: 90%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;text-align: left
        }
        .collapse-div {
          font-size: 10px;
          margin:10px 5px 10px 5px;
          box-shadow: 0px 0px 2px black;
          padding: 5px;
          box-sizing: border-box;
          border-radius: 5px;
        }
    }
    .asidebtn{
      width: calc(100% - 20px);
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
        position: relative;
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
        display: flex;
        justify-content: center;
        align-items: center;
        .rect{
          position: absolute;
          z-index: 200;
          width: 100%;
          height: 100%;
        }
      }
    }
  }
}

::-webkit-scrollbar{
  display: none;
}
</style>

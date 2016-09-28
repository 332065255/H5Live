(function(){
	var Live={
		//flv的直播地址
		_liveSrc:"",
		//video标签id
		_videoid:"",
		_thisL:null,
		///初始化方法
		init:function(liveSrc,videoid){
			
			this._liveSrc=liveSrc;
			this._videoid=videoid;
			mediaSourceEx.init(this._liveSrc);
			videoEx.init(this._videoid);
			videoEx.src(mediaSourceEx.getSrc());
		}
	};
	//主要播放库
	var mediaSourceEx={
		mediaSource:null,
		_this:null,
		_liveSrc:"",
		sourceBuffer:null,
		firstRun:false,
		mimeCodec:'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
		lastVSample:null, 
		lastVDuration:null, 
		vduration:null,
		lastASample:null, 
		lastADuration:null, 
		aduration:null,
		soFar:null,
		_this:null,
		blobs:null,
		//没用完的mp4数据集合
		arr:[],
		//整理好的tag集合
		arrTag:[],
		//第一个metadata tag,第一个视频tag,第一个音频tag  集合
		arrMetaTag:[],
		//半截tag集合
		arrTempCache:[],
		//临时储存u8a
		arrTemp:[],
		//是否读完了第一个MAV
		fristMoov:true,
		//是否赋值了MAV
		fristMoovSet:false,
		//解码open;
		decodeOpen:true,
		//临时tag
		tempTag:[],
			
		testIndex:0,
			
		videoTrackF:{},
		audioTrackF:{},
			
		sclas:1,
		firstSet:false,

		init:function(liveSrc){
			_this=this;
			_this._liveSrc=liveSrc;
			_this.mediaSource=new MediaSource;
			_this.mediaSource.addEventListener('sourceopen',_this.sourceOpen);
			
		},
		getSrc:function(){
//			return "http://gao11.cn/1.mp4"
			return URL.createObjectURL(this.mediaSource);
		},
		sourceOpen:function(){
			console.log("this's open",_this.mediaSource.readyState);
				if(!_this.firstRun)
				{
					_this.sourceBuffer =_this.mediaSource.addSourceBuffer(_this.mimeCodec);
					_this.sourceBuffer.addEventListener('error', () => console.log('sourceBuffer: error'));
					_this.sourceBuffer.addEventListener('abort', () => console.log('sourceBuffer: abort'));
					_this.sourceBuffer.addEventListener('updateend', () => {
						console.log('sourceBuffer: updateend')
						_this.sourceBufferOnUpdateend();
					});
			
					_this.sourceBuffer.addEventListener('update', () => {
						let ranges = [];
						let buffered = _this.sourceBuffer.buffered;
						for (let i = 0; i < buffered.length; i++) {
							ranges.push([buffered.start(i), buffered.end(i)]);
						}
						console.log('bufupdate:', JSON.stringify(ranges), 'time', videoEx.video.currentTime);
			
						if (buffered.length > 0) {
							if (videoEx.video.currentTime < buffered.start(0) || 
									videoEx.video.currentTime > buffered.end(buffered.length-1)) 
							{
								videoEx.video.currentTime = buffered.start(0)+0.1;
							}
						}
					});
					var req = new Request(_this._liveSrc, {method: 'GET', cache: 'default',mode:"cors"});  
				    fetch(req).then(function(response) {  
				    		//  typeof(response.body)==ReadableStream
				        var reader = response.body.getReader();  
				        /*
				         * response.body是一个ReadableStream的实现对象
				         * ReadableStream的官方文档地址https://streams.spec.whatwg.org/#rs-class
				         * ReadableStream.getReader()的官方解释The getReader method creates a reader of the type specified by the mode option and locks the stream to the new reader. While the stream is locked, no other reader can be acquired until this one is released.
				         * getReader()方法是可以带参数的getReader({ mode } = {})
				         * When mode is undefined, the method creates a default reader (an instance of ReadableStreamDefaultReader). The reader provides the ability to directly read individual chunks from the stream via the reader’s read() method.
				         * 
				         * When mode is "byob", the getReader method creates a BYOB reader (an instance of ReadableStreamBYOBReader). This feature only works on readable byte streams, i.e. streams which were constructed specifically with the ability to handle "bring your own buffer" reading. The reader provides the ability to directly read individual chunks from the stream via the reader’s read() method, into developer-supplied buffers, allowing more precise control over allocation.
				         * 
				         * 如果getReader()什么都不写,就是基本的ReadableStreamDefaultReader 对象,read()方法也是全自动的
				         * 
				         * 如果getReader({'mode':'byob'}),会返回一个ReadableStreamBYOBReader 对象
				         * 
				         * ReadableStreamBYOBReader对象就屌了
				         * 
				         * 3.6.4.3. read(view)

							The read method will write read bytes into view and return a promise resolved with a possibly transferred buffer as described below.
							If the chunk does become available, the promise will be fulfilled with an object of the form { value: theChunk, done: false }.
							If the stream becomes closed, the promise will be fulfilled with an object of the form { value: undefined, done: true }.
							If the stream becomes errored, the promise will be rejected with the relevant error.
							If reading a chunk causes the queue to become empty, more data will be pulled from the underlying byte source.
							If ! IsReadableStreamBYOBReader(this) is false, return a promise rejected with a TypeError exception.
							If this.[[ownerReadableStream]] is undefined, return a promise rejected with a TypeError exception.
							If Type(view) is not Object, return a promise rejected with a TypeError exception.
							If view does not have a [[ViewedArrayBuffer]] internal slot, return a promise rejected with a TypeError exception.
							If view.[[ByteLength]] is 0, return a promise rejected with a TypeError exception.
							Return ! ReadableStreamBYOBReaderRead(this, view).
				         * 
				         * 很明显,这个read方法需要传入一个viewArrayBuffer的对象进去,而这个viewArrayBuffer可以uint8Array,但是这个对象长度不能为0
				         * 如果这个viewArrayBuffer对象的长度是10000,那么read(viewArrayBuffer).then(function(chunk,done){console.log(chunk.bytelength)})//这里输出为10000,就是你可以自己控制读取多少数据
				         * 屌了吧...
				         */
				        return _this.readr(reader);
				    })
				    _this.firstRun=true;
			   	}
		},
		readr:function(reader){
				return reader.read().then(function (result) {
		            
            			const chunk = result.value;///Uint8Array

					if (result.done) {
		                console.log("this's over");
//		                _this.mediaSource.endOfStream();
		                return reader.cancel();
		            }
            			_this.soFar += chunk.byteLength;
//          			if(soFar>50000)
//          			{
//          				_this.Progresss(new Uint8Array(arrTempCache))
						_this.Progresss(chunk);
//          				arrTempCache=[];
//          				soFar=0;
//          			}
//          			else
//          			{
//          				
//          				arrTempCache=arrTempCache.concat(_this.Uint8Array2Array(chunk))
//          				console.log(soFar,arrTempCache.length)
//          				return _this.readr(reader);
//          			}
//          			console.log(soFar,"current",chunk.byteLength);
            			
            			if(_this.arrMetaTag.length>3&&!_this.fristMoovSet)
            			{
            				console.log(_this.arrMetaTag);
            				var arrT=[];
            				for(var i=0;i<_this.arrMetaTag.length;i++)
            				{
            					arrT=arrT.concat(_this.arrMetaTag[i]);
            				}
            				let parser = new InitSegmentParser();
            				
            				let flvhdr=parser.push(new Uint8Array(arrT))
//          				console.log(flvhdr);
            				let stream=flvhdr
            				stream.duration = stream.meta.duration;
            				stream.duration=stream.duration==0?3600:stream.duration;
            				stream.timeStart = 0;
						stream.timeEnd = stream.duration;
            				
            				let record = flvhdr.firstv.AVCDecoderConfigurationRecord;
						console.log('probe:', `h264.profile=${record[1].toString(16)}`, 'meta', flvhdr);
		
						this.videoTrack = {
							type: 'video',
							id: 1,
							duration: 0,
							width: flvhdr.meta.width,
							height: flvhdr.meta.height,
							AVCDecoderConfigurationRecord: flvhdr.firstv.AVCDecoderConfigurationRecord,
						};
						_this.videoTrackF=videoTrack;
						this.audioTrack = {
							type: 'audio',
							id: 2,
							duration: this.videoTrack.duration,
							channelcount: flvhdr.firsta.channelCount,
							samplerate: flvhdr.firsta.sampleRate,
							samplesize: flvhdr.firsta.sampleSize,
							AudioSpecificConfig: flvhdr.firsta.AudioSpecificConfig,
						};
						_this.audioTrackF=audioTrack;
//						console.log(this.videoTrack,this.audioTrack)
//						sclas=mp4mux.timeScale
						var result=mp4mux.initSegment([this.videoTrack, this.audioTrack], stream.duration*mp4mux.timeScale)
//						console.log(result);
						_this.sourceBuffer.appendBuffer(result);
//						stream.timeStart = this.duration;
//						stream.timeEnd = this.duration+stream.duration;
//						stream.indexStart = this.keyframes.length;
            				
            				_this.fristMoovSet=true;
            				console.log("执行了metadata的赋值","余下数据量",_this.arrTemp.length)
//          				return reader.cancel();
            			}
            			else if(_this.arrMetaTag.length>3&&_this.arrTag.length>0)
            			{
            				_this.testIndex+=1;
            				
            				let segpkts = parseMediaSegment(new Uint8Array(_this.arrTag));
//          				console.log(segpkts)
            				var u8arr=(_this.decodeflv2Mp4(segpkts));
//          				
            				_this.arrTag=[];
            				
            				
            				if(!_this.sourceBuffer.updating&&_this.arr.length==0)
						{
//							_this.arr=_this.arr.concat(_this.Uint8Array2Array(u8arr))
//							_this.arr.push(_this.Uint8Array2Array(u8arr))
//							var u8a=new Uint8Array(_this.arr.shift());//拿出所有完整的tag
////							_this.arrTag=[];
							_this.sourceBuffer.appendBuffer(u8arr);
//							_this.arr=[];
							console.log("执行成功一次",_this.sourceBuffer.buffered);
//							firstSet=true;
//							for(var i=0;i<_this.sourceBuffer.buffered.length;i++)
//							{
//								console.log("start",_this.sourceBuffer.buffered.start(i),"end",_this.sourceBuffer.buffered.end(i))
//							}
							
						}
						else
						{
//							_this.arr=_this.arr.concat(_this.Uint8Array2Array(u8arr))
							_this.arr.push(_this.Uint8Array2Array(u8arr));
							console.log("还在更新呢",_this.sourceBuffer.buffered);
//							for(var i=0;i<_this.sourceBuffer.buffered.length;i++)
//							{
//								console.log("start",_this.sourceBuffer.buffered.start(i),"end",_this.sourceBuffer.buffered.end(i))
//							}
						}
            			}
            			
//          			if(_this.testIndex==100)
//          			{
//          				return reader.cancel();
//          			}
//          			console.log(_this.sourceBuffer.appendBuffer)
					
            			
            			
//          			console.log(_this.soFar);
            			return _this.readr(reader);
            	})
			},
			sourceBufferOnUpdateend:function(){
				if(_this.arr.length>0)
				{
					var u8a=new Uint8Array(_this.arr.shift());//拿出所有完整的tag
	//							_this.arrTag=[];
					_this.sourceBuffer.appendBuffer(u8a.buffer);
				}
			},
			//主体解码flv2mp4
			decodeflv2Mp4 :function(segpkts){
				let videoTrack = _this.videoTrackF;
				let audioTrack = _this.audioTrackF;
				
				videoTrack._mdatSize = 0;
				videoTrack.samples = [];
				audioTrack._mdatSize = 0;
				audioTrack.samples = [];
				
				
				for(var i=0;i<segpkts.length;i++)
				{
					if(segpkts[i].type=='video'&&segpkts[i].NALUs)
					{
						delete videoTrack._firstTime;
					}
				}
				for(var i=0;i<segpkts.length;i++)
				{
					if(segpkts[i].type=='audio'&&segpkts[i].frame)
					{
						delete audioTrack._firstTime;
					}
				}
				segpkts.filter(pkt => pkt.type == 'video' && pkt.NALUs).forEach((pkt, i) => {
					let sample = {};
					sample._data = pkt.NALUs;
					sample._offset = videoTrack._mdatSize;
					sample.size = sample._data.byteLength;
					videoTrack._mdatSize += sample.size;
					
					if (videoTrack._firstTime === undefined) {
						videoTrack._firstTime = pkt.dts*_this.sclas;
					}
					sample._dts = pkt.dts*_this.sclas;
					sample.compositionTimeOffset = pkt.cts*mp4mux.timeScale;
		
					sample.flags = {
						isLeading: 0,
						dependsOn: 0,
						isDependedOn: 0,
						hasRedundancy: 0,
						paddingValue: 0,
						isNonSyncSample: pkt.isKeyFrame?0:1,
						degradationPriority: 0,
					};
//					console.log("视频tags的当前时间轴",sample._dts)
					if (_this.lastVSample) {
						let diff = sample._dts-_this.lastVSample._dts;
						_this.lastVSample.duration = diff*mp4mux.timeScale;
						_this.vduration += diff;
						_this.lastVDuration = diff;
					}
					_this.lastVSample = sample;
					videoTrack.samples.push(sample);
				});
				_this.lastVSample.duration = _this.lastVDuration*mp4mux.timeScale;
				videoTrack._lastTime = (_this.lastVSample._dts+_this.lastVDuration)*_this.sclas;
				
				aduration = 0;
				segpkts.filter(pkt => pkt.type == 'audio' && pkt.frame).forEach((pkt, i) => {
					let sample = {};
					sample._data = pkt.frame;
					sample._offset = audioTrack._mdatSize;
					sample.size = sample._data.byteLength;
					audioTrack._mdatSize += sample.size;
		
					//dbp('audiosample', pkt.dts, pkt.frame.byteLength);
		
					if (audioTrack._firstTime === undefined) {
						audioTrack._firstTime = pkt.dts;
					}
					sample._dts = pkt.dts;
		
					if (_this.lastASample) {
						let diff = sample._dts-_this.lastASample._dts;
						_this.lastASample.duration = diff*mp4mux.timeScale;
						_this.aduration += diff;
						_this.lastADuration = diff;
					}
					_this.lastASample = sample;
					audioTrack.samples.push(sample);
				});
				if(_this.lastASample)
				_this.lastASample.duration = _this.lastADuration*mp4mux.timeScale;
				audioTrack._lastTime = _this.aduration+_this.lastADuration+audioTrack._firstTime;
				
				videoTrack.baseMediaDecodeTime = videoTrack._firstTime*mp4mux.timeScale;
				if(audioTrack._firstTime===undefined)
				audioTrack.baseMediaDecodeTime = 0;
				else
				audioTrack.baseMediaDecodeTime = audioTrack._firstTime*mp4mux.timeScale;
				
				let moof, _mdat, mdat;
				let list = [];
//				console.log("视频包开始时间",videoTrack._firstTime,"视频包结束时间",videoTrack._lastTime,"音频包开始时间",audioTrack._firstTime,"音频包结束时间",audioTrack._lastTime,"视频包大小",videoTrack._mdatSize,"音频包大小",audioTrack._mdatSize)
				moof = mp4mux.moof(0, [videoTrack]);
				_mdat = new Uint8Array(videoTrack._mdatSize);
				videoTrack.samples.forEach(sample => _mdat.set(sample._data, sample._offset));
				mdat = mp4mux.mdat(_mdat);
				list = list.concat([moof, mdat]);
		
				moof = mp4mux.moof(0, [audioTrack]);
				_mdat = new Uint8Array(audioTrack._mdatSize);
				audioTrack.samples.forEach(sample => _mdat.set(sample._data, sample._offset));
				mdat = mp4mux.mdat(_mdat);
				list = list.concat([moof, mdat]);
		
				return _this.concatUint8Array(list);
			},
			concatUint8Array:function(list) {
				let len = 0;
				list.forEach(b => len += b.byteLength)
				let res = new Uint8Array(len);
				let off = 0;
				list.forEach(b => {
					res.set(b, off);
					off += b.byteLength;
				})
				return res;
			},
			//拿到u8a一次处理
			Progresss:function(u8a){
				_this.arrTemp=_this.arrTemp.concat(_this.Uint8Array2Array(u8a))
				if(_this.fristMoov&&!_this.fristMoovSet)
				{
					if(_this.arrTemp.length>24)///保证flv的header和metadata的tag header是存在的
					{
						_this.fristMoov=_this.fristMAV(_this.arrTemp)
						return _this.fristMoov;
					}
					return false;
				}
				else
				{
					_this.decodeOpen=true;
					_this.getAVTag(_this.arrTemp);
//					console.log("走其余的tag")
				}
			},
			Uint8Array2Array:function(u8a) {
				var arr = [];
				for (var i = 0; i < u8a.length; i++) {
					arr.push(u8a[i]);
				}
				return arr;
			},
						//第一个metadata,视频tag,音频tag是否读完
			fristMAV:function(u8a){
				//拿出flv header
				if(_this.arrMetaTag.length<1)
				{
					var header=[];
					for(var i=0;i<13;i++)
					{
						header.push(_this.arrTemp.shift());
					}
					_this.arrMetaTag.push(header);
				}
				//拿出metadata
				if(_this.arrMetaTag.length<2)
				{
					
					var meta=[];
					for(i=0;i<11;i++)
					{
						meta.push(_this.arrTemp.shift())
					}
					var bodySize=_this.getBodySize(meta);
					if(_this.arrTemp.length>=(bodySize+4))
					{
						for(i=0;i<(bodySize+4);i++)
						{
							meta.push(_this.arrTemp.shift())
						}
						_this.arrMetaTag.push(meta);
					}
					else
					{
						//如果包体没有那么大,就把临时数组还原,等下次再解析
						_this.arrTemp=meta.concat(_this.arrTemp);
						return false;
					}
				}
				//拿出音频或者视频
				if(_this.arrMetaTag.length<3)
				{
					var Atag=[];
					if(_this.arrTemp.length>11)
					{
						for(i=0;i<11;i++)
						{
							Atag.push(_this.arrTemp.shift())
						}
					}
					else
					{
						return false;
					}
					var bodySize=_this.getBodySize(Atag);
					if(_this.arrTemp.length>=(bodySize+4))
					{
						for(i=0;i<(bodySize+4);i++)
						{
							Atag.push(_this.arrTemp.shift())
						}
						_this.arrMetaTag.push(Atag);
					}
					else
					{
						//如果包体没有那么大,就把临时数组还原,等下次再解析
						_this.arrTemp=Atag.concat(_this.arrTemp);
						return false;
					}
				}
				//拿出音频或者视频
				if(_this.arrMetaTag.length<4)
				{
					var Vtag=[];
					if(_this.arrTemp.length>11)
					{
						for(i=0;i<11;i++)
						{
							Vtag.push(_this.arrTemp.shift())
						}
					}
					else
					{
						return false;
					}
					var bodySize=_this.getBodySize(Vtag);
					if(_this.arrTemp.length>=(bodySize+4))
					{
						for(i=0;i<(bodySize+4);i++)
						{
							Vtag.push(_this.arrTemp.shift())
						}
						_this.arrMetaTag.push(Vtag);
						return true;
					}
					else
					{
						//如果包体没有那么大,就把临时数组还原,等下次再解析
						_this.arrTemp=Vtag.concat(_this.arrTemp);
						return false;
					}
				}
			},
			//获取包体大小
			getBodySize:function(arr){
				var a=arr[1].toString(16).length==1?"0"+arr[1].toString(16):arr[1].toString(16);
				var b=arr[2].toString(16).length==1?"0"+arr[2].toString(16):arr[2].toString(16);
				var c=arr[3].toString(16).length==1?"0"+arr[3].toString(16):arr[3].toString(16);
				return parseInt((a+""+b+""+c),16)
			},
			//获取完整的tag
			getAVTag:function(u8a){
				while(_this.decodeOpen){
					if(u8a.length>11)
					{
						_this.tempTag=[];
						for(var i=0;i<11;i++)
						{
							_this.tempTag.push(_this.arrTemp.shift())
						}
					}
					else
					{
						_this.decodeOpen=false;
						continue;
					}
					var bodySize=_this.getBodySize(_this.tempTag);
					if(_this.getBodySize(_this.tempTag)==35)
					{
						_this.getBodySize(_this.tempTag);
					}
					if(_this.arrTemp.length>=(bodySize+4))
					{
						for(i=0;i<(bodySize+4);i++)
						{
							_this.tempTag.push(_this.arrTemp.shift())
						}
//						arrTag.push(_this.tempTag);
					}
					else
					{
						//如果包体没有那么大,就把临时数组还原,等下次再解析
						_this.arrTemp=_this.tempTag.concat(_this.arrTemp);
						_this.decodeOpen=false;
						continue;
					}
//					arrTag.push(_this.tempTag);
					_this.arrTag=_this.arrTag.concat(_this.tempTag);
					
				}
			},
	};
	//播放器
	var videoEx={
		video:null,
		_thisM:null,
		init:function(videoid){
			_thisM=this;
			_thisM.video=document.getElementById(videoid);
		},
		src:function(src){
			_thisM.video.src=src;
			_thisM.video.play();
			_thisM.video.addEventListener("loadedmetadata",_thisM.loadedmetadata)
			_thisM.video.addEventListener("timeupdate",_thisM.timeupdate)
			_thisM.video.addEventListener('ended',_thisM.endFun,false)
			_thisM.video.addEventListener('error',_thisM.errorFun,false);
		},
		loadedmetadata:function(){
			console.log("获取metadata成功");
			var div=document.getElementById("time");
			div.innerHTML="/"+parseInt(_thisM.video.duration);
		},
		endFun:function(){
			console.log("stop")
		},
		errorFun:function(e){
			console.log("error",e,elem.error)		
		},
		timeupdate:function(){
			var div=document.getElementById("time");
			div.innerHTML=parseInt(_thisM.video.currentTime)+"/"+parseInt(_thisM.video.duration);
		}
	};
	window.Live=Live;
})()

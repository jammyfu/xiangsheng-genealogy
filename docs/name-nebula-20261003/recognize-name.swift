import Foundation
import Vision
import ImageIO
let url=URL(fileURLWithPath:CommandLine.arguments[1])
let source=CGImageSourceCreateWithURL(url as CFURL,nil)!
let image=CGImageSourceCreateImageAtIndex(source,0,nil)!
let request=VNRecognizeTextRequest()
request.recognitionLanguages=["zh-Hans"]
request.recognitionLevel = .accurate
request.usesLanguageCorrection=false
try VNImageRequestHandler(cgImage:image,options:[:]).perform([request])
let result=(request.results ?? []).compactMap { item -> [String:Any]? in
 guard let text=item.topCandidates(1).first else { return nil }
 let box=item.boundingBox
 return ["text":text.string,"confidence":text.confidence,"x":(box.minX+box.width/2)*Double(image.width),"y":(1-box.minY-box.height/2)*Double(image.height)]
}
let data=try JSONSerialization.data(withJSONObject:result)
print(String(data:data,encoding:.utf8)!)

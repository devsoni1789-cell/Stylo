import {useMemo,useState,type ChangeEvent} from "react";

const API="https://ai-stylist-backend-v2-production.up.railway.app";

type Profile={usable:boolean;note?:string;faceShape?:string;hairstyle?:string;proportions?:string;skinToneUndertone?:string;bestColors?:string[];existingStyle?:string;summary?:string};
type Outfit={title:string;items:{top?:string;bottom?:string;outerwear?:string;shoes?:string;watch?:string;eyewear?:string;accessory?:string};why:string;colorNotes?:string};
type OutfitResponse={outfits:Outfit[];hairstyleSuggestion?:string;eyewearSuggestion?:string;accessorySuggestion?:string};

const occasions=["Casual","College","Office","Date","Party","Wedding","Formal","Travel"];

async function jsonPost(path:string,body:unknown){
  const r=await fetch(API+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const d=await r.json();
  if(!r.ok) throw new Error(d?.error||"Something went wrong");
  return d;
}

function fileToData(file:File):Promise<{data:string;mediaType:string}>{
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>{const s=String(reader.result);const i=s.indexOf(",");resolve({data:s.slice(i+1),mediaType:file.type||"image/jpeg"});};
    reader.onerror=()=>reject(new Error("Could not read photo"));
    reader.readAsDataURL(file);
  });
}

export default function App(){
  const [photo,setPhoto]=useState<string>("");
  const [photoData,setPhotoData]=useState<{data:string;mediaType:string}|null>(null);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [outfits,setOutfits]=useState<OutfitResponse|null>(null);
  const [occasion,setOccasion]=useState("Casual");
  const [selected,setSelected]=useState(0);
  const [result,setResult]=useState("");
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");

  const current=outfits?.outfits?.[selected];
  const canGenerate=Boolean(photoData&&current);

  async function upload(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0]; if(!file)return;
    if(file.size>15*1024*1024){setError("Photo must be under 15 MB.");return;}
    setError("");setResult("");setOutfits(null);setProfile(null);
    const d=await fileToData(file);
    setPhoto("data:"+d.mediaType+";base64,"+d.data);setPhotoData(d);
    try{
      setBusy("Analyzing your style…");
      const p=await jsonPost("/api/analyze",{imageBase64:d.data,mediaType:d.mediaType});
      setProfile(p);
      if(!p.usable) throw new Error(p.note||"Please upload a clear photo of yourself.");
      setBusy("Creating personalized outfits…");
      const o=await jsonPost("/api/outfits",{profile:p,occasion});
      setOutfits(o);setSelected(0);
    }catch(err){setError(err instanceof Error?err.message:"Could not analyze photo.");}
    finally{setBusy("");}
  }

  async function changeOccasion(next:string){
    setOccasion(next); if(!profile)return;
    try{setError("");setBusy("Creating new looks…");const o=await jsonPost("/api/outfits",{profile,occasion:next});setOutfits(o);setSelected(0);setResult("");}
    catch(err){setError(err instanceof Error?err.message:"Could not create looks.");}finally{setBusy("");}
  }

  async function generate(){
    if(!photoData||!current)return;
    try{
      setError("");setResult("");setBusy("Generating your realistic look…");
      const d=await jsonPost("/api/try-on",{imageBase64:photoData.data,mediaType:photoData.mediaType,outfit:current,occasion,hairstyle:outfits?.hairstyleSuggestion,eyewear:outfits?.eyewearSuggestion,accessory:outfits?.accessorySuggestion});
      setResult("data:"+d.mediaType+";base64,"+d.imageBase64);
    }catch(err){setError(err instanceof Error?err.message:"Image generation failed.");}
    finally{setBusy("");}
  }

  const profileChips=useMemo(()=>profile?.bestColors?.slice(0,5)||[],[profile]);

  return <div className="app">
    <header><div className="brand"><span className="mark">S</span><div><b>Stylo</b><small>AI PERSONAL STYLIST</small></div></div><span className="pill">AI STYLE STUDIO</span></header>

    <main>
      <section className="hero">
        <div className="eyebrow">YOUR PHOTO → YOUR LOOK</div>
        <h1>See yourself<br/><em>styled by AI.</em></h1>
        <p>Upload one photo. Stylo studies your style, builds complete outfits, then generates a realistic preview of you wearing the look.</p>
        <label className="upload"><input type="file" accept="image/*" onChange={upload}/><span>✦</span>{photo?"Change photo":"Upload your photo"}</label>
        <div className="privacy">🔒 Your photo is processed only to create your style result.</div>
      </section>

      <section className="occasion">
        <div className="sectionTitle"><span>01</span><b>Choose the occasion</b></div>
        <div className="chips">{occasions.map(x=><button className={occasion===x?"active":""} onClick={()=>changeOccasion(x)} key={x}>{x}</button>)}</div>
      </section>

      {photo&&<section className="workspace">
        <div className="photoCard"><img src={photo}/><div className="photoLabel">YOUR PHOTO</div></div>
        <div className="panel">
          <div className="sectionTitle"><span>02</span><b>Your AI stylist</b></div>
          {profile&&<div className="profile"><strong>{profile.summary}</strong><div className="tags">{profile.faceShape&&<span>{profile.faceShape} face</span>}{profile.skinToneUndertone&&<span>{profile.skinToneUndertone} undertone</span>}{profileChips.map(c=><span key={c}>{c}</span>)}</div></div>}
          {outfits&&<><div className="sectionTitle looksTitle"><span>03</span><b>Recommended looks</b></div><div className="looks">{outfits.outfits.map((o,i)=><button className={selected===i?"look activeLook":"look"} onClick={()=>{setSelected(i);setResult("")}} key={i}><div><b>{o.title}</b><small>{o.items.top||""} · {o.items.bottom||""}</small></div><span>→</span></button>)}</div></>}
          {current&&<div className="selected"><b>{current.title}</b><p>{current.why}</p><div className="outfitItems">{Object.entries(current.items).filter(([,v])=>v).map(([k,v])=><span key={k}><small>{k}</small>{v}</span>)}</div></div>}
          <button className="generate" disabled={!canGenerate||Boolean(busy)} onClick={generate}>{busy||"✦  SHOW ME HOW I’LL LOOK"}</button>
          {error&&<div className="error">{error}</div>}
        </div>
      </section>}

      {result&&<section className="result"><div className="resultHead"><div><span>04</span><b>Your generated look</b><small>AI-generated fashion preview</small></div><a href={result} download="stylo-look.jpg">Save image ↓</a></div><img src={result}/></section>}

      {!photo&&<section className="features"><div><b>01</b><strong>Personalized</strong><p>Recommendations are based on your uploaded photo and chosen occasion.</p></div><div><b>02</b><strong>Complete looks</strong><p>Get the outfit, shoes, accessories, hair and eyewear—not just a shirt.</p></div><div><b>03</b><strong>AI preview</strong><p>Generate a new realistic image instead of placing a flat graphic over your body.</p></div></section>}
    </main>
  </div>
}

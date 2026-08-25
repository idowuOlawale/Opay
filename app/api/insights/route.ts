import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema={type:"object",properties:{account_name:{type:"string"},account_number:{type:"string"},statement_period:{type:"string"},currency:{type:"string"},executive_summary:{type:"string"},financial_health:{type:"string"},totals:{type:"object",properties:{total_inflow:{type:"number"},total_outflow:{type:"number"},net_cash_flow:{type:"number"},opening_balance:{type:"number"},closing_balance:{type:"number"},highest_balance:{type:"number"},lowest_balance:{type:"number"}},required:["total_inflow","total_outflow","net_cash_flow","opening_balance","closing_balance","highest_balance","lowest_balance"],additionalProperties:false},monthly_cash_flow:{type:"array",items:{type:"object",properties:{month:{type:"string"},income:{type:"number"},expense:{type:"number"},net:{type:"number"},transaction_count:{type:"number"}},required:["month","income","expense","net","transaction_count"]}},top_senders:{type:"array",items:{type:"object",properties:{name:{type:"string"},count:{type:"number"},total:{type:"number"},reason:{type:"string"}},required:["name","count","total","reason"]}},top_recipients:{type:"array",items:{type:"object",properties:{name:{type:"string"},count:{type:"number"},total:{type:"number"},reason:{type:"string"}},required:["name","count","total","reason"]}},largest_transactions:{type:"array",items:{type:"object",properties:{date:{type:"string"},description:{type:"string"},amount:{type:"number"},direction:{type:"string"}},required:["date","description","amount","direction"]}},recurring_patterns:{type:"array",items:{type:"string"}},unusual_patterns:{type:"array",items:{type:"string"}},actionable_insights:{type:"array",items:{type:"string"}},transactions:{type:"array",items:{type:"object",properties:{date:{type:"string"},description:{type:"string"},debit:{type:"number"},credit:{type:"number"},balance:{type:"number"},channel:{type:"string"}},required:["date","description","debit","credit","balance","channel"]}}},required:["account_name","account_number","statement_period","currency","executive_summary","financial_health","totals","monthly_cash_flow","top_senders","top_recipients","largest_transactions","recurring_patterns","unusual_patterns","actionable_insights","transactions"]};

async function extractPdfText(buffer:Buffer){
  const pdfjs=await import("pdfjs-dist/legacy/build/pdf.mjs");
  const params={data:new Uint8Array(buffer),useWorkerFetch:false} as any;
  const doc=await pdfjs.getDocument(params).promise;
  const pages:string[]=[];
  for(let i=1;i<=doc.numPages;i++){
    const page=await doc.getPage(i);
    const content=await page.getTextContent();
    pages.push(content.items.map((item:any)=>typeof item?.str==="string"?item.str:"").join(" "));
  }
  return pages.join("\n").replace(/\u0000/g,"").trim();
}

export async function POST(req:Request){
 try{
  const key=process.env.YDC_API_KEY;
  if(!key)return NextResponse.json({error:"YDC_API_KEY is not configured in Vercel."},{status:500});
  const form=await req.formData();
  const file=form.get("file");
  if(!(file instanceof File))return NextResponse.json({error:"Upload a PDF bank statement."},{status:400});
  const filename=(file.name||"").toLowerCase();
  if(!filename.endsWith(".pdf"))return NextResponse.json({error:"Please select a PDF bank statement."},{status:400});
  if(file.size>15*1024*1024)return NextResponse.json({error:"PDF is too large. Please upload a statement under 15 MB."},{status:413});
  const buffer=Buffer.from(await file.arrayBuffer());
  let statementText="";
  try{statementText=await extractPdfText(buffer)}catch(error){console.error("PDF ingestion failed",error);return NextResponse.json({error:"StatementIQ could not read this PDF. Please upload a normal, text-readable bank statement PDF."},{status:422});}
  if(!statementText)return NextResponse.json({error:"This PDF contains no readable text. Please upload a text-readable bank statement."},{status:422});
  const prompt=`You are StatementIQ, an AI financial statement analysis agent. Analyze ONLY the supplied bank-statement text. Reconstruct the ledger faithfully, reconcile totals where possible, and return account identity, period, currency, balances, inflow/outflow/net cash flow, monthly cash flow, top senders, top recipients, largest transactions, recurring patterns, unusual patterns only when supported, actionable insights, and the transaction ledger. Do not invent data. Preserve statement values.\n\nSTATEMENT CONTENT:\n${statementText.slice(0,40000)}`;
  const r=await fetch("https://api.you.com/v1/research",{method:"POST",headers:{"Content-Type":"application/json","X-API-Key":key},body:JSON.stringify({input:prompt,research_effort:"standard",output_schema:schema})});
  const raw=await r.text();
  let j:any;try{j=JSON.parse(raw)}catch{return NextResponse.json({error:`You.com returned HTTP ${r.status} with an unreadable response.`},{status:502})}
  if(!r.ok)return NextResponse.json({error:j?.detail||j?.error||`You.com Research API failed (${r.status}).`},{status:502});
  const analysis=j?.output?.content;
  if(!analysis||typeof analysis!=="object")return NextResponse.json({error:"You.com returned no structured analysis."},{status:502});
  return NextResponse.json({analysis});
 }catch(error){console.error("StatementIQ analysis error",error);return NextResponse.json({error:error instanceof Error?error.message:"Statement analysis failed."},{status:500})}
}

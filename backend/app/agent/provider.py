from openai import OpenAI
import json
import logging

class GroqProvider:
    @staticmethod
    def _validate_schema(data, required_fields):
        for field in required_fields:
            if field not in data:
                raise ValueError(f"Missing required field: {field}")
        return True

    @staticmethod
    def generate(prompt, api_key, model_name="gpt-oss-20b", is_json=False, required_fields=None):
        if not api_key or "your" in api_key.lower():
            raise ValueError("Groq API key is invalid or unauthorized.")

        try:
            client = OpenAI(
                base_url="https://api.groq.com/openai/v1",
                api_key=api_key
            )
            
            structured_prompt = prompt
            if is_json:
                structured_prompt += "\n\nYou MUST return ONLY valid raw JSON data matching the required schema. DO NOT include markdown blocks (`json ...`). Just the raw curly braces."

            response = client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": structured_prompt}],
                temperature=0,
            )
            
            output = response.choices[0].message.content.strip()
            
            if is_json:
                if output.startswith("```json"):
                    output = output[7:]
                if output.startswith("```"):
                    output = output[3:]
                if output.endswith("```"):
                    output = output[:-3]
                output = output.strip()
                
                parsed = json.loads(output)
                if required_fields:
                    GroqProvider._validate_schema(parsed, required_fields)
                return parsed
                
            return output
        except json.JSONDecodeError as e:
            logging.error(f"JSON Parse Error: {str(e)} - Raw Output: {output}")
            raise Exception("Groq returned malformed JSON.")
        except Exception as e:
            logging.error(f"Groq API Error: {str(e)}")
            raise e

package com.cs.demo;
import java.io.IOException;
import java.io.InputStream;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;

import javax.jws.WebMethod;
import javax.jws.WebService;
import javax.xml.bind.JAXBContext;
import javax.xml.bind.JAXBException;
import javax.xml.bind.Unmarshaller;

import org.apache.commons.io.IOUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import org.springframework.ws.server.endpoint.annotation.Endpoint;
import org.springframework.ws.server.endpoint.annotation.PayloadRoot;
import org.springframework.ws.server.endpoint.annotation.ResponsePayload;

import com.cs.demo.pojo.DataSource;
import com.cs.demo.pojo.DataSources;

@Component("helloWs")
@WebService
//@Endpoint
public class HelloWorldWS{

	private static final String NAMESPACE_URI = "http://demo.cs.com/";
	
	
	@WebMethod(operationName="getHelloWorld")
	/*@PayloadRoot(namespace = NAMESPACE_URI, localPart = "getHelloWorld")
	@ResponsePayload*/
	public String getHelloWorld() {

		/*try {
			return getFileContent().getDatasource().get(0);
		} catch (IOException | JAXBException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}*/
		return "Uttam";

	}
	
	@WebMethod(operationName="getDataSource")
	/*@PayloadRoot(namespace = NAMESPACE_URI, localPart = "getDataSource")
	@ResponsePayload*/
	public DataSources getDataSource() {

		try {
			return getFileContent();
		} catch (IOException | JAXBException e) { }
		
		return null;

	}


	//@Bean
	public DataSources getFileContent() throws IOException, JAXBException{
		
		/*Resource resource = new ClassPathResource(config.getPath());
		InputStream  inp = resource.getInputStream();
		String result = IOUtils.toString(inp, StandardCharsets.UTF_8);
		System.out.println("Content..... >>>>>> "+result);
		
		JAXBContext jaxbContext = JAXBContext.newInstance(DataSources.class);
		Unmarshaller unmarshal = jaxbContext.createUnmarshaller();
		DataSources datasources = (DataSources) unmarshal.unmarshal(new StringReader(result));
		System.out.println("List printed ----- >>>>> "+datasources);*/
		return null;
		
	}
	
	
}